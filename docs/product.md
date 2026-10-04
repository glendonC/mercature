# Product

Mercature helps a small tour operator act on what visitors tell her about a walk, in languages she cannot read. A small model on her phone reads each visitor's message and finds the spot on her walk it means; the app fills a reply in English, Spanish or Korean from fixed templates and her map. She decides. After one download it works offline. The interface is in English and Spanish. The Spanish interface, and the Spanish and Korean notes and replies, have not been reviewed by a native speaker.

It answers the tourism challenge of the World Bank Small AI for Development brief (Annex C): a small operator who cannot read every visitor's language and has no simple way to turn feedback into an improvement.

## The place: the Qorikancha walk

A real walking route in Cusco, from the Plaza de Armas to the Qorikancha ticket booth: 594 m in 60 stretches, built from 403 Mapillary street photos taken between 2015 and 2023. When the route was prepared, a large segmentation model scanned 116 views of those photos and made 480 marks above its threshold. It left out 1 pothole mark, because the photos show a manhole or drain cover there; the package keeps 287 of the other 479 (footway, cobblestones, kerbs, road, steps, crossings, broken pavement), the 218 near the walk and 69 more on the 27 published photos. Separately, the walk's build has 52 findings of steps and kerbs on its stretches, including one OpenStreetMap steps tag. 8 of the 52 are flagged as possible barriers, at 5 spots; none has been checked by a person.

## How it works

1. **The walk.** Opening the place replays how the walk was built from its photos, then shows it on a leaning city map with labelled markers.
2. **Messages.** Visitor messages arrive in an inbox (the ones shipped with the app are labelled Example). The model says whether each is a problem, praise or a question and which spot it means, and the map flies there.
3. **Reply.** A reply in the visitor's language (English, Spanish or Korean) is drafted from fixed templates and what her map says about the spot, ready to copy.
4. **Not sure.** When the model cannot tell, it says so and she taps the spot. For messages the model cannot read, such as Quechua, the phone remembers her choice for similar messages later.
5. **Her map.** She keeps it current: mark a spot fixed, add her note, remove a spot or add one. Messages pile up on their spots, and a route note for visitors can be copied in English, Spanish or Korean.

## Who it is for

In the brief, Noor farms in the fictional Ondera highlands; we set her farm in La Convención, Cusco, for the synthetic messages. Her farm exists in Mercature as the model's synthetic training data: the example messages that trained its heads are about an authored farm, labelled synthetic. Its workspace stays in the code, reachable only through a test entry, and is not offered in the app. The app's place is the real walk.

## What the model does and does not do

- It answers only from fixed lists: message kind, and the place's own named spots. It never writes free text: replies are fixed templates filled from her map, so it cannot invent a place, a measurement or a promise.
- When it is unsure it says Not sure, and she decides. Messages that do not look like English, Spanish or Korean always get Not sure.
- It does not translate, and it does not judge whether a path is passable.
- On the route the issue type is never shown: it did not carry over from the farm-trained model.
- Each message she files on a spot leaves an example on the device: its embedding and a sketch of its spelling, never the text. Only messages that fail the language check, such as Quechua, use these examples: on machine-translated Quechua test messages the right spot came first for 5 of 16 with no links, and 9.4 of 16 (mean of 20 draws) with three linked messages per spot. Only the order of spots changes. This limit was decided after the test, because one Korean message lost its right spot in a few draws.
- A large model ran once to prepare the route; only the small model runs on the phone.

Results by language, size and speed are in [language](language.md).

## Honesty limits

- No widths, heights, slopes or reachability are claimed on the route. A stretch with no flagged barrier means only that no barrier was seen in the photos.
- Photo marks were recorded once, when the route was prepared, and none has been checked by a person.
- The farm and all test messages are synthetic; the messages were written by a large language model and none has been reviewed by a native speaker.
- A saved plan or note is a proposal, not proof that anything changed on the ground.
- No phone has been measured, and no real operator has used it.

## Responsible AI

- **Privacy.** Messages are read on the phone, and no message, edit or link is sent anywhere. The deployed app loads everything from its own site. The model downloads from there too, and falls back to Hugging Face only if those files cannot load. Start over deletes the place's messages, edits and remembered links.
- **Consent.** She pastes messages visitors already sent her. The app collects nothing from visitors and sends nothing to them; she copies each reply herself.
- **Bias and limits.** The model reads Latin and Korean script only. Messages that fail the language check always get Not sure. Every Quechua message in the held-out and route tests failed it, and 146 of the 147 in the memory test. Once she files a message on a spot, similar messages that fail the check put that spot first. One large language model wrote every test message, and the Spanish and Korean text in the app has not been reviewed by a native speaker.
- **Oversight.** A sure answer is filed on its best spot and she can move it; on Not sure she taps the spot. She edits the map and copies every reply herself, and the model never writes free text.

## Data

Street photos from Mapillary (CC BY-SA 4.0, credited on every photo), places and paths from OpenStreetMap (ODbL), a walking route from Valhalla, and model-written test messages (CC0). The figures behind the problem, every dataset, and what the data does not cover are in [evidence](evidence.md).

## Out of scope

Bookings, payments, accounts, a server database, sending messages and accessibility certification.
