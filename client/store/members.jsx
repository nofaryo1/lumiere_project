import { app } from "./app";
import { api, query } from "../lib/api";
import { toast } from "./ui";
import { isView } from "./router";

let membersRequest = 0;

export async function loadMembers(reset) {
  const m = app.state.members;
  const id = ++membersRequest;
  app.update(() => { m.loading = true; });
  try {
    const q = query({ limit: "30", offset: String(reset ? 0 : m.users.length), search: m.q.trim() });
    const res = await api(`/members/all?${q}`);
    if (!isView("members") || id !== membersRequest) return;
    m.users = reset ? res.users : [...m.users, ...res.users];
    m.total = res.total;
    m.hasMore = res.hasMore;
  } catch (err) {
    toast(err.message);
  }
  m.loading = false;
  app.update();
}

let queryTimer = 0;
export function setMembersQuery(q) {
  app.update(() => { app.state.members.q = q; });
  clearTimeout(queryTimer);
  queryTimer = setTimeout(() => loadMembers(true), 300);
}
