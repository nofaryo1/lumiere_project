import React, { useEffect, useRef, useState } from "react";
import { app } from "../../store/app";
import { setTrending } from "../../store/trending";

// The notes field of the perfume filters, with suggestions from the notes on the site
export function NotesFilter({ noteNames }) {
  const { trending } = app.use();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const [value, setValue] = useState(trending.notes);
  const [matches, setMatches] = useState(null);
  const [active, setActive] = useState(-1);
  const timer = useRef(0);

  // "Clear filters" empties the field too
  useEffect(() => { if (trending.notesSeq) { setValue(""); setMatches(null); } }, [trending.notesSeq]);

  useEffect(() => {
    if (active < 0 || !boxRef.current) return;
    const item = boxRef.current.children[active];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => { setActive(-1); setMatches(null); };
  const open = (text = inputRef.current.value) => {
    const parts = text.split(",");
    const term = parts[parts.length - 1].trim().toLowerCase();
    const chosen = new Set(parts.slice(0, -1).map((t) => t.trim().toLowerCase()));
    const found = noteNames
      .filter((n) => !chosen.has(n.toLowerCase()) && (!term || n.toLowerCase().includes(term)))
      .sort((a, b) => Number(b.toLowerCase().startsWith(term)) - Number(a.toLowerCase().startsWith(term)))
      .slice(0, 8);
    setActive(-1);
    setMatches(found.length ? found : null);
    return found;
  };
  const apply = (text) => setTrending({ notes: text });
  const choose = (note) => {
    const parts = inputRef.current.value.split(",");
    parts[parts.length - 1] = note;
    const text = parts.map((t) => t.trim()).filter(Boolean).join(", ");
    setValue(text);
    close();
    apply(text);
  };

  const onKeyDown = (e) => {
    if (!matches) { if (e.key === "ArrowDown") { const found = open(); if (found.length) setActive(0); e.preventDefault(); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1 + matches.length) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(matches[active]); }
    else if (e.key === "Escape") close();
  };

  return (
    <div className="filter-field">
      <label htmlFor="filterNotes">Notes</label>
      <div className="filter-field__control">
        <input id="filterNotes" type="search" placeholder="e.g. vanilla, oud" autoComplete="off" ref={inputRef}
               role="combobox" aria-autocomplete="list" aria-expanded={String(!!matches)} aria-controls="notesSuggest"
               aria-activedescendant={matches && active >= 0 ? `noteOption${active}` : undefined}
               value={value}
               onFocus={() => open()}
               onChange={(e) => {
                 const text = e.target.value;
                 setValue(text);
                 open(text);
                 clearTimeout(timer.current);
                 timer.current = setTimeout(() => apply(text), 150);
               }}
               onKeyDown={onKeyDown}
               onBlur={() => setTimeout(close, 120)} />{" "}
        <div className="search-suggest notes-suggest" id="notesSuggest" role="listbox" aria-label="Notes" hidden={!matches} ref={boxRef}>
          {(matches || []).map((n, i) => (
            <button type="button" key={n} className={`suggest-item${i === active ? " is-active" : ""}`} role="option" id={`noteOption${i}`}
                    data-note={n} aria-selected={String(i === active)}
                    onMouseDown={(e) => { e.preventDefault(); choose(n); }}>
              <span className="suggest-item__name">{n}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
