# Product

Mercature helps a small tour operator keep her tour route current and act on what visitors tell her about it, in languages she cannot read. An on-screen guide takes her through the route one spot at a time, then through her visitors' messages. A small model on her phone reads each message and finds the spot it means; the app fills a reply in English, Spanish or Korean from fixed templates and her answers. She decides. After one download it works offline. The interface is in English and Spanish. The Spanish interface, and the Spanish and Korean notes and replies, have not been reviewed by a native speaker.

It answers the tourism challenge of the World Bank Small AI for Development brief (Annex C): a small operator who cannot read every visitor's language and has no simple way to turn feedback into an improvement.

## The places

Two real tour routes, prepared once from public street photos and map data:

- **Qorikancha, Cusco.** From the Plaza de Armas to the Qorikancha ticket booth: 594 m in 60 stretches, built from 403 Mapillary street photos taken between 2015 and 2023.
  - When the route was prepared, a large segmentation model scanned 116 views of those photos on a GPU and made 480 marks above its threshold.
  - It left out 1 pothole mark, because the photos show a manhole or drain cover there. The package keeps 287 of the other 479 (footway, cobblestones, kerbs, road, steps, crossings, broken pavement): the 218 near the route and 69 more on the 27 published photos.
  - Separately, the route's build has 52 findings of steps and kerbs on its stretches, including one OpenStreetMap steps tag. 8 of the 52 are flagged as possible barriers, at 5 spots; none has been checked by a person.
- **Narikala, Tbilisi.** From the Narikala cable car top station to the fortress gate: 1,019 m in 102 stretches, built from 359 Mapillary street photos taken between 2016 and 2025. 49 findings are flagged as possible barriers, at 14 spots; none has been checked by a person.

Each route also carries what OpenStreetMap records along it: 44 records on Qorikancha and 95 on Narikala. Home search builds a route to any other place on the device, from OpenStreetMap alone, with no street photos read.

## How it works

1. **The route.** Opening a place replays how its route was built: the street photos, the partial 3D they give, the 10 m stretches, and what a model marked in the photos. The guide then greets her on the map.
2. **The check.** The guide takes her to each spot that might give visitors trouble. It shows the clearest street photo with the model's outline on it, what OpenStreetMap records there, and who it affects. She answers what is there now, and how visitors get past it.
3. **A way around.** When she says there is no way around, the guide offers the one OpenStreetMap's router finds, with how much longer it is (on Qorikancha, 679 m instead of 594). She looks at it on the map and keeps it or not. Nobody has checked it.
4. **Edit.** She adds what the photos missed, such as a bench, marks a spot fixed or removes one. The guide shows what visitors will now read. Before and Now compare the route as prepared with her changes.
5. **Messages.** Visitor messages come one at a time. The ones shipped with the app are labelled Example, and the Quechua ones also Machine-translated. The model on the device says which spot a message means, or Not sure and up to three spots, and she confirms or taps the spot. She can also paste a message she received.
6. **Reply.** A reply in English, Spanish or Korean is filled from fixed templates and her answers, ready to copy. A Quechua message gets the Spanish reply.
7. **Route note.** A note for visitors in English, Spanish or Korean follows her answers; she copies it.

## Noor's farm

In the brief, Noor farms in the fictional Ondera highlands; we set her farm in La Convención, Cusco, for the synthetic messages. Her farm exists in Mercature as the model's synthetic training data: the example messages that trained its heads are about an authored farm, labelled synthetic. Its workspace stays in the code, reachable only through a test entry, and is not offered in the app. The app's places are the real routes.

## What the model does and does not do

- It answers only from fixed lists: message kind, and the place's own named spots. It never writes free text: replies are fixed templates filled from her answers, so it cannot invent a place, a measurement or a promise.
- The guide's lines are fixed text, written in advance in English and Spanish and filled from the place's records and her answers. Neither the guide nor the model writes free text.
- When it is unsure it says Not sure, and she decides. Messages that do not look like English, Spanish or Korean always get Not sure.
- It does not translate, and it does not judge whether a path is passable.
- On the route the issue type is never shown: it did not carry over from the farm-trained model.
- Each message she files on a spot leaves an example on the device: its embedding and a sketch of its spelling, never the text. Only messages that fail the language check, such as Quechua, use these examples: on machine-translated Quechua test messages the right spot came first for 5 of 16 with no links, and 9.4 of 16 (mean of 20 draws) with three linked messages per spot. Only the order of spots changes. This limit was decided after the test, because one Korean message lost its right spot in a few draws.
- Large models ran once, on a GPU when each route was prepared: SAM 3 outlined the photos and VGGT built the partial 3D. Only the small model runs on the phone.

Results by language, size and speed are in [language](language.md).

## Honesty limits

- No widths, heights, slopes or reachability are claimed on a route. A stretch with nothing flagged means only that nothing was flagged in its photos.
- Photo marks and the 3D were made once, when each route was prepared, and none has been checked by a person.
- Lines from OpenStreetMap say so, and were never checked by a person. Widths and inclines are left out on purpose.
- A way around is OpenStreetMap's router's suggestion; nobody has checked it.
- A line on who a barrier affects says it is hard for someone, such as wheelchair users or people with strollers; no line says anyone cannot pass.
- A route built by search has no street photos read. It shows what OpenStreetMap lists, and its route is not checked.
- The farm and all test messages are synthetic; the messages were written by a large language model and none has been reviewed by a native speaker.
- A fix she marks, a note or a change is her record, not proof that anything changed on the ground.
- No phone's speed has been measured, and no real operator has used it.

## Responsible AI

- **Privacy.** Messages are read on the device, and no message, edit or link is sent anywhere. Search is the one exception:
  - Typing filters the prepared places on the device; Enter sends the typed words to OpenStreetMap's Nominatim.
  - Building a route asks the Valhalla server at openstreetmap.de for the route on foot, and the Overpass API (overpass-api.de, or maps.mail.ru as a second server) for map data near it. A built route is kept on the device.
  - Everything else loads from the app's own site. The model loads from there too, and falls back to Hugging Face only if those files cannot load.
  - Start over deletes the place's messages, edits and remembered links.
- **Consent.** She pastes messages visitors already sent her. The app collects nothing from visitors and sends nothing to them; she copies each reply herself.
- **Bias and limits.** The model reads Latin and Korean script only. Messages that fail the language check always get Not sure. Every Quechua message in the held-out and route tests failed it, and 146 of the 147 in the memory test. Once she files a message on a spot, similar messages that fail the check put that spot first. One large language model wrote every test message, and the Spanish and Korean text in the app has not been reviewed by a native speaker.
- **Oversight.** The guide proposes and she answers; nothing on her map changes without her tap. A sure answer is filed on its best spot and she can move it; on Not sure she taps the spot. She copies every reply herself.

## Data

- Street photos from Mapillary (CC BY-SA 4.0, credited on every photo), and partial 3D built from them by VGGT, shared under the same license.
- Places, paths and the records along each route from OpenStreetMap (ODbL).
- Routes on foot and ways around from Valhalla.
- Model-written test messages (CC0).

The figures behind the problem, every dataset, and what the data does not cover are in [evidence](evidence.md).

## Out of scope

Bookings, payments, accounts, a server database, sending messages and accessibility certification.
