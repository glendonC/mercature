# Product

Mercature helps a small tour operator understand what a visitor reported, in any language, see where on her site it happened, and test a fix before the next visit. It runs in the browser on a phone she already has, and its core works offline.

It answers the tourism challenge of the World Bank Small AI for Development brief (Annex C): a small operator who cannot read every visitor's language and has no simple way to turn feedback into a concrete improvement.

## Who it is for

Noor runs coffee farm tours for a few visitors a month in La Convención, in the Cusco region of Peru. She speaks Quechua at home and Spanish with everyone else. Visitors write to her in English, Korean and other languages. She uses her daughter's smartphone at weekends and buys mobile data when she needs it. Her coffee cooperative helps members with tools like this one.

Noor and her farm are fictional, like the persona in the brief. Her site in Mercature is an authored model and is labeled synthetic.

## The loop

1. **Message.** Noor pastes or types what a visitor wrote. The original text is kept.
2. **Understand.** A small multilingual model on the phone answers three questions from fixed lists: is this a problem, praise or a question; what kind of problem; and which parts of the site it most likely concerns (up to three). When it is not sure, it says so.
3. **Confirm.** Noor chooses the part of the site, or picks another one. Nothing changes until she does.
4. **Try a fix.** She moves or removes the obstruction in the site model. A deterministic check shows which places a wheelchair-width path reaches before and after, including any new problem the move creates.
5. **Save and reply.** The plan keeps the message, her choice, the change and the result. She can answer the visitor with a pre-written message in the visitor's language.

## What the AI does and does not do

- It answers only from fixed lists: three message kinds, six issue types and the site's own named features. It never writes free text, so it cannot invent a place, a measurement or a promise.
- It ranks the site's features by meaning across languages. It does not translate and it does not decide whether a path is passable.
- Unclear results are shown as "Not sure", and Noor chooses herself or checks with the visitor.
- The path check is ordinary deterministic code. A saved plan is a proposal, not proof that anything changed on the farm.

## Model and device

- A quantized multilingual sentence encoder, with small classifier heads trained on labeled example messages for this site.
- Downloaded once and cached on the phone. After that, understanding a message needs no connection.
- The application itself is under 1 MB. Model size, accuracy by language and speed are reported in [language](language.md).

## Languages

- Operator interface: Spanish and English.
- Visitor messages: evaluated in English, Spanish and Korean.
- Less-supported language: Quechua is tested and its results are reported, including failures.

## Live and prepared

- **Live:** understanding new messages, the path check, comparison, saving, and offline use after the first download.
- **Prepared:** Noor's farm model is authored. The destination examples on Home show recorded street imagery from an earlier preparation run; they are labeled as recorded.
- **Not built:** turning new photos into a site model, measured real sites, and sending messages.

## Out of scope

Bookings, payments, accounts, a server database and accessibility certification.
