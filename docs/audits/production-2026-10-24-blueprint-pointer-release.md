# Blueprint pointer-release finalization — 2026-10-24

PR831 deployed as a8c28d1d9b8b2b2e145dd27f0ad9435d6a79fe7b. Vercel Production Overview Ready/currentdomainbango-os.vercel.app/deployment3q98bEjks3fhUy9V1CamkQtQzfDC confirmed. All9PR831workflows passed; mainjob121047786444 lint/build/contracts/new64geometry+summarytests passed; productiondependency audit0. Lint0errors/28warnings and known nonfatalpdfjsdist ESMexternalization warning remain.

## Live follow-up

Production shows3oldtakeoffsexcludedfromtotalsandlegacyverificationnotice. Page1newcalibration4ft persisted; horizontal19.89ft/vertical12ft/area240ft² observed. Some QA gestures produced9.47ft and3.75ft² for smaller/wronglytargetedregions; retained asQA history, not accepted as known-reference tests. One early zoom test reused a pre-zoom coordinate closure; corrected by passing fresh bounds explicitly. Fresh source-bound area test persisted240ft². Readbacktakeoffsummary41.36linearft/243.75sqft includes19.89+9.47+12 and3.75+240; all3legacytakeoffs remainexcluded. No quantity correction/deletion performed.

Page2rendered portrait; attemptedDistancebeforecalibrationrejectedwithcalibrate-current-pageerrorand0annotations. Independent10ftcalibrationcreated. Its drawn endpoint visually stopped short of the intended release point. Sourcehandlerconfirms pointerupusesactiveDraft.points only, ignoringthereleaseeventposition. Cancelwasalsohandledascompletion. Thereforefinalpointer/portraitacceptanceremainsopen.

## Fix

Use pointer-release coordinates as authoritative line/measurement endpoint, retaining existing wall/dimension snapping. Appendreleasepointtofreehandpaths. Zero-length clicks create noannotation. Cancelclearsactivegesturewithoutpersistingpartialmeasurement. Existingcoordinates/history/dataaccessandmetricmathunchanged.

## Validation

New actualstrokehelper tests cover release with nofinalmove or stale/coalescedmove,20ftdistance/240sqftarea,nonmutation,click/zero-lengthrejection,closedfreehand,sourceendpoint/snapping/cancelintegration. Existing64metricandtakeoffsummarytestsremainpassed. FinalCI/deploy/livefullworkflowrequired.
