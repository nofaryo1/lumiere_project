import { app } from "./app";
import { api } from "../lib/api";
import { toast } from "./ui";

async function loadProfileList(kind) {
  const profile = app.state.profile;
  const username = profile.data.user.username;
  profile.list = null;
  try {
    const res = await api(`/users/${encodeURIComponent(username)}/${kind}?limit=60`);
    if (profile.data && profile.data.user.username === username && profile.tab === kind) {
      profile.list = { kind, ...res };
      app.update();
    }
  } catch (err) {
    toast(err.message);
  }
}

export function setProfileTab(tab) {
  app.update(() => { app.state.profile.tab = tab; });
  if (tab === "followers" || tab === "following") loadProfileList(tab);
}

export function setProfileMode(changes) {
  app.update(() => Object.assign(app.state.profile, changes));
}
