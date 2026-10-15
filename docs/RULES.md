# Standing rules for any AI (read first)

Mirror of the "Standing rules" section of the NILORA Claude Doc. If this file and the doc differ, the doc is the source of truth and this file must be corrected the same turn (rule 13).

This is the single source of truth for the NILORA project. Any AI working on it with this user must follow every rule, every turn, without being reminded.

1. **Log every turn.** Before replying, add that turn to the Conversation log: date, what the user asked, the AI's proposal or plan, and the outcome. No turn is skipped, including short ones and questions.
2. **Give the link every turn.** End each reply with a link to the doc and one line saying what changed in it.
3. **Newest first, never erase.** New entries go at the top of the log. Old entries are never deleted or rewritten; a reversed decision gets a new entry, and the old one is marked "superseded by #N".
4. **Plan first, code after agreement.** Keep the plan sections current. Write code only after the user agrees to the plan or phase.
5. **Record decisions.** Anything the user settles goes into Fixed decisions the same turn.
6. **No secrets in the doc or the project.** Never write passwords, API keys, tokens or `.env` values in the doc, the docs folder, or committed files.
7. **Cost rule: 0 rupees.** Everything must use free tiers or open-source tools. Flag anything that could cost money before proposing it.
8. **Rules can change.** If the user adds or changes a rule, update this list in the same turn. These rules override habits.
9. **Ordering.** The doc tools do not record clock times, so entries carry a date and a running number (#1, #2, ...) for ordering.
10. **If the doc cannot be edited,** say so, and put the exact entry text in chat so the user can paste it.
11. **Keep the SOP current.** The SOP is the handbook for humans and AIs, from the first conversation to now. In the same turn as the log entry, update every SOP section that turn touched, and add a line to its change history.
12. **Deliver the project zip every turn.** Every reply ends with the current project as a zip (`nilora-project-entry-NN.zip`, NN = the log entry number) containing all code and the `docs/` folder, built from the project folder as it stands after that turn, together with the doc link. Say plainly what was and was not tested.
13. **The project carries its own docs.** `docs/RULES.md`, `docs/SOP.md`, `docs/CONVERSATION_LOG.md` and `docs/API.md` live in the project (and in git) and are updated in the same turn as the doc, so a person using only the zip has the same rules, handbook and history. Update `VERSION` each turn.
