import React from "react";
import { app } from "../../store/app";
import { LEVELS, levelOf, myWear, myAgree, toggleOpinion, votePerformance } from "../../store/perfumePage";
import { sum } from "../../lib/format";
import { Icon } from "../common/Icon";

// Horizontal bars: [label, value, shown text, is it the member's own pick]
export function Bars({ entries }) {
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return entries.map(([label, v, display, isMine]) => (
    <div className={`hbar${isMine ? " hbar--mine" : ""}`} key={label}>
      <span className="hbar__label">{label}</span>
      <span className="hbar__track"><span className="hbar__fill" style={{ width: `${(v / max) * 100}%` }} /></span>
      <span className="hbar__value">{display ?? v}</span>
    </div>
  ));
}

function VoteChips({ attr, options, isOn, label, onVote }) {
  return (
    <div className="vote-row" role="group" aria-label={label}>
      <span className="vote-row__label">Your vote</span>
      {options.map(([value, text]) => (
        <button key={value} className="vote-chip" {...{ [attr]: value }} aria-pressed={String(isOn(value))} onClick={() => onVote(value)}>{text}</button>
      ))}
    </div>
  );
}

export function PerfMeter({ name, label, base, p }) {
  const { session } = app.use();
  const names = LEVELS[name];
  const real = p.perf ? p.perf.counts[name] : [0, 0, 0, 0, 0];
  const my = p.perf && session.user ? p.perf.mine[name] : null;
  const level = levelOf(base.perf[name].map((c, i) => c + real[i]));
  const result = level ? names[level - 1] : "No votes yet";
  return (
    <div className="meter">
      <div className="meter__top"><span>{label}</span><strong>{result}</strong></div>
      <div className="meter__bar" role="img" aria-label={`${label}: ${result}`}>
        {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= level ? "is-on" : ""} />)}
      </div>
      <VoteChips attr="data-perf" options={names.map((n, i) => [`${name}:${i + 1}`, n])} isOn={(v) => v === `${name}:${my}`}
                 label={`Your ${label.toLowerCase()} vote`} onVote={(v) => votePerformance(p, name, Number(v.split(":")[1]))} />
    </div>
  );
}

export function WearBlock({ keys, base, p }) {
  const real = p.perf ? p.perf.wear.counts : {};
  const mine = myWear(p);
  const counts = keys.map((k) => base.wear[k] + (real[k] || 0));
  const total = sum(counts) || 1;
  return (
    <>
      <div className="pv__bars"><Bars entries={keys.map((k, i) => [k, counts[i], `${Math.round((counts[i] / total) * 100)}%`, mine.includes(k)])} /></div>
      <VoteChips attr="data-wear" options={keys.map((k) => [k, k])} isOn={(k) => mine.includes(k)} label="Your picks" onVote={(k) => toggleOpinion(p, "wear", k)} />
    </>
  );
}

export function VerdictList({ kind, items, p }) {
  const real = p.perf ? p.perf.agree.counts : {};
  const mine = myAgree(p);
  return items.map((it) => {
    const key = `${kind}:${it.text}`;
    return (
      <li className="verdict__item" key={key}>
        <span className="verdict__icon"><Icon name={kind === "pros" ? "check" : "close"} /></span>
        <span className="verdict__text">{it.text}</span>
        <button className="verdict__vote" data-agree={key} aria-pressed={String(mine.includes(key))} aria-label={`Agree: ${it.text}`} onClick={() => toggleOpinion(p, "agree", key)}>
          <Icon name="thumb" />
          <span>{it.votes + (real[key] || 0)}</span>
        </button>
      </li>
    );
  });
}
