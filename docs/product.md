# Product

Mercature helps a small tour operator act on what visitors tell her about a place, in languages she cannot read. A small model on her phone reads a visitor's message and points to the spots on her route it most likely means. She checks each one on a real street photo and decides. After one download it works offline.

It answers the tourism challenge of the World Bank Small AI for Development brief (Annex C): a small operator who cannot read every visitor's language and has no simple way to turn feedback into an improvement.

## The place: the Qorikancha walk

A real walking route in Cusco, from the Plaza de Armas to the Qorikancha ticket booth: 594 m in 60 stretches, seen through 403 Mapillary street photos taken between 2015 and 2023. When the route was prepared, a large segmentation model outlined steps and kerbs in the photos. 8 of the 52 findings are flagged as possible barriers, on 6 stretches. None is verified until the operator checks it.

## The loop

1. **Place.** The route on a monochrome map, with its real photos and the possible barriers.
2. **Message.** She pastes what a visitor wrote. The model says whether it is a problem, praise or a question, and the spots it most likely means light up, best first.
3. **Verify on the photo.** For each suggested spot she opens the photo with its recorded outline and chooses Confirm, Not a barrier, or Check on site.
4. **Changes.** She adds a visitor note from fixed templates and copies a pre-written reply in English, Spanish or Korean.

## Example: Noor's farm

Noor, the operator in the brief, runs coffee farm tours in La Convención. Her farm is an authored map labeled Example. On it, the operator can move an obstruction and recheck which places a path 0.9 m wide reaches before and after (an illustrative width, not a wheelchair standard).

## What the model does and does not do

- It answers only from fixed lists: message kind, and the place's own named spots. It never writes free text, so it cannot invent a place, a measurement or a promise.
- When it is unsure it says Not sure, and she decides. Messages that do not look like English, Spanish or Korean always get Not sure.
- It does not translate, and it does not judge whether a path is passable.
- On the route the issue type is never shown: it did not carry over from the farm-trained model.
- A large model ran once to prepare the route; only the small model runs on the phone.

Results by language, size and speed are in [language](language.md).

## Honesty limits

- No widths, heights, slopes or reachability are claimed on the route. A stretch with no flagged barrier means only that no barrier was seen in the photos.
- Photo outlines are recorded and unverified until the operator confirms them.
- The farm and all test messages are synthetic; the messages were written by a large language model and none has been reviewed by a native speaker.
- A saved plan or note is a proposal, not proof that anything changed on the ground.
- No phone has been measured, and no real operator has used it.

## Data

Street photos from Mapillary (CC BY-SA 4.0, credited on every photo), places and paths from OpenStreetMap (ODbL), a walking route from Valhalla, and model-written test messages (CC0). The figures behind the problem, every dataset, and what the data does not cover are in [evidence](evidence.md).

## Out of scope

Bookings, payments, accounts, a server database, sending messages and accessibility certification.
