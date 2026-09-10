# Operations

Keep the GPU runtime private. Set `BOS_RASTER2SEQ_BRIDGE_COMMAND` only on the Blueprint inference service host after the Raster2Seq runtime has passed the real-plan benchmark. If the bridge is absent, slow, or fails, B.O.S. returns no learned geometry and keeps deterministic geometry authoritative.