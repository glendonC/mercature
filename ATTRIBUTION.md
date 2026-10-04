# Attribution

## Cover photographs

These destination covers are navigation, never evidence of assessed site geometry. Resized WebP copies are used; CSS masks, cropping, opacity and desaturation alter their presentation.

- [Qorikancha](https://commons.wikimedia.org/wiki/File:Cuzco,_Coricancha,_2023_(01).jpg): Draceane, 2023, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The adapted photograph remains under this license.
- [Narikala](https://commons.wikimedia.org/wiki/File:Looking_towards_Narikala_Fortress_from_the_cable_car_station.jpg): shankar s., 2016, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
- [Swayambhu](https://commons.wikimedia.org/wiki/File:Stairs_with_365_steps_to_climb_to_Swayambhunath_(17209517714).jpg): Jorge Láscar, 2014, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).

## Font and dependencies

Outfit is Copyright 2021 The Outfit Project Authors, licensed under the [SIL Open Font License 1.1](licenses/Outfit-OFL.txt).

React and React DOM use MIT; Vite and TypeScript use MIT and Apache-2.0 respectively; Playwright uses Apache-2.0. Exact versions and transitive dependencies are recorded in the lockfile; their distributions retain their licenses.

The guide on the hidden farm workspace and the loopback inspection screen uses [bot-avatars](https://libraries.dev/bots) 0.1.2 by Jakub Antalik, Copyright 2026, under the [MIT license](licenses/Bot-avatars-MIT.txt). Colors and motion settings are adapted to Mercature. Bot animation represents interface state, not proof of AI inference.

[thinking-orbs](https://libraries.dev/orbs) 0.3.2 by Jakub Antalik, Copyright 2026, under the [MIT license](licenses/Thinking-orbs-MIT.txt), is listed as a dependency but not used by the app.

## Published place package

`public/places/qorikancha` ships 27 views of Mapillary street photos along the Qorikancha walk (12 crops of 360° photos and 15 resized photos), the records of the 403 photos used, OpenStreetMap context and the walking route. Each photo keeps its contributor, capture date, source link and license (CC BY-SA 4.0) in `place.json`, and the app shows them with the photo. The views are adaptations and remain under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Map data is from OpenStreetMap contributors under the ODbL. No point clouds are published.

## Local destination inspection

The local Mapillary route records (Narikala and Swayambhu), their images and every point cloud are supplied locally and excluded from version control and build output. Their per-image creator, capture date, source link and license are displayed from the original records. Geographic context retains OpenStreetMap contributor attribution and ODbL terms. Existing local-only and no-redistribution restrictions remain enforced; displaying a reconstruction does not grant redistribution or measured-access acceptance.

## Mark

The Mercature mark samples land outlines from [Natural Earth](https://www.naturalearthdata.com/) 1:110m, version 4.1.0 (public domain), as redistributed by [world-atlas](https://github.com/topojson/world-atlas) 2.0.2.

## Recorded destination examples

The destination records, including the published Qorikancha package, were prepared earlier with [Valhalla](https://github.com/valhalla/valhalla) routes (MIT) on OpenStreetMap data and SAM 3 photo outlines (SAM License). The local-only records also hold VGGT-1B-Commercial reconstructions (custom licence), which are not published. Those tools are not part of this application; each keeps its own licence.

## Language model and runtime

Message understanding runs [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) by Microsoft (MIT), through the [Xenova ONNX export](https://huggingface.co/Xenova/multilingual-e5-small) pinned at revision `761b726d`. The weights are downloaded once to the device. They are not in this repository, but the live site serves a trimmed copy of the MIT-licensed weights from its own origin, with [the license](licenses/multilingual-e5-small-MIT.txt) beside them. Inference uses [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT) and tokenization uses [@huggingface/tokenizers](https://github.com/huggingface/tokenizers) (Apache-2.0).
