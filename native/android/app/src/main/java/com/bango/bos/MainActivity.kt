package com.bango.bos

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var pendingWebPermissionRequest: PermissionRequest? = null

    private val mediaPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            val request = pendingWebPermissionRequest
            pendingWebPermissionRequest = null
            if (request != null) resolveWebPermissionRequest(request)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val target = request?.url ?: return true
                if (isAllowed(target)) return false
                if (target.scheme in setOf("mailto", "tel", "sms")) {
                    startActivity(Intent(Intent.ACTION_VIEW, target))
                }
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request ?: return
                runOnUiThread { handleWebPermissionRequest(request) }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest?) {
                if (pendingWebPermissionRequest == request) pendingWebPermissionRequest = null
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl(PRODUCTION_URL)
        }
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }

    override fun onDestroy() {
        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = null
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }

    private fun handleWebPermissionRequest(request: PermissionRequest) {
        if (!isAllowed(request.origin)) {
            request.deny()
            return
        }

        val requestedResources = request.resources.toSet()
        val supportedResources = setOf(
            PermissionRequest.RESOURCE_AUDIO_CAPTURE,
            PermissionRequest.RESOURCE_VIDEO_CAPTURE,
        )
        if (requestedResources.isEmpty() || !supportedResources.containsAll(requestedResources)) {
            request.deny()
            return
        }

        val missingPermissions = requestedResources
            .mapNotNull(::androidPermissionForWebResource)
            .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            .distinct()

        if (missingPermissions.isEmpty()) {
            resolveWebPermissionRequest(request)
            return
        }

        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = request
        mediaPermissionLauncher.launch(missingPermissions.toTypedArray())
    }

    private fun resolveWebPermissionRequest(request: PermissionRequest) {
        if (!isAllowed(request.origin)) {
            request.deny()
            return
        }

        val grantedResources = request.resources.filter { resource ->
            val permission = androidPermissionForWebResource(resource) ?: return@filter false
            checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
        }

        if (grantedResources.size == request.resources.size && grantedResources.isNotEmpty()) {
            request.grant(grantedResources.toTypedArray())
        } else {
            request.deny()
        }
    }

    private fun androidPermissionForWebResource(resource: String): String? = when (resource) {
        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
        else -> null
    }

    private fun isAllowed(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host?.lowercase() == "bango-os.vercel.app"

    companion object {
        private const val PRODUCTION_URL = "https://bango-os.vercel.app"
    }
}
