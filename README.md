# Plastic Pal Finder

This is a PLANNING conversation only — please do not write or edit any code yet, just discuss and propose an architecture.

Project: a browser-based demo of a contamination-aware plastic waste classification and recycling-recommendation system. It must run entirely client-side with NO external backend/API calls — everything (models + logic) needs to live inside this Lovable app itself.

Pipeline to replicate:
1. Webcam capture of a live video frame.
2. Object detection: a YOLOv8s model (single class: "plastic") finds plastic items in the frame.
3. A second, off-the-shelf person-detector (COCO-pretrained, class "person") runs in parallel as an exclusion filter, so detections overlapping a person are suppressed — this is the key ask, since the standalone plastic detector alone is not reliable at rejecting humans in frame.
4. On each accepted detection: two independent classifiers run on the cropped region — (a) resin type: PET / PE-HD / PP / PS, (b) contamination severity: clean_or_light / moderate_dirt_synth / high_dirt_synth.
5. A rule-based lookup (12 rows: 4 resins x 3 severities) maps the (resin, severity) pair to a disposal action, a recycling route, and a reuse suggestion, then displays it as a recommendation card.

All four models (plastic detector, person detector, resin classifier, contamination classifier) are already trained externally (YOLOv8s + ResNet18 in PyTorch) and would be exported to ONNX and run in-browser via onnxruntime-web as static assets — no server-side inference.

Please propose: the page/component structure, how you'd handle onnxruntime-web integration and model loading/caching, how the person-exclusion filter logic should work against the plastic detector's boxes, how you'd structure the Stage 3 rule table in TypeScript, and a realistic sense of which parts are straightforward vs. likely to need iteration. Also flag anything about this approach that seems like it will fight Lovable's normal patterns.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://plastic-decoder-web.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1b65391d-9117-4a31-bd55-6da229d56160).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
