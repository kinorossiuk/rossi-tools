# Portrait generator regression checks

The browser check serves the real client files and the test-data HTML with PHP
blocks removed. It verifies generation, grouping metadata, reload restoration,
old cartoon-state isolation, cancellation, reset, image loading failures and
storage failures. It does not exercise PHP authentication or a production host.
The face check uses OpenCV's bundled frontal-face Haar detector and validates
ZIP integrity, JPG dimensions, unique contents, and exactly one detected face
per output image. Passing it does not guarantee Kanana device recognition.

Dependencies can stay outside the repository:

```bash
npm install --prefix /tmp/portrait-browser-deps --cache /tmp/portrait-npm-cache playwright
python3 -m venv /tmp/rossi-portrait-qa
/tmp/rossi-portrait-qa/bin/pip install opencv-python-headless==4.12.0.88
NODE_PATH=/tmp/portrait-browser-deps/node_modules PORTRAIT_QA_OUTPUT=/tmp/rossi-portrait-results node tests/portrait-generator.cjs
/tmp/rossi-portrait-qa/bin/python tests/check-portrait-faces.py /tmp/rossi-portrait-results
```

Set `CHROME_BIN` if Chrome is not installed at `/usr/bin/google-chrome`.
Face-detector results depend on the named OpenCV version. Inspect the generated
photos as well and check Kanana face detection and grouping on the real device.
