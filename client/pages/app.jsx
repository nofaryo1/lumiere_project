// The whole site is one React app (views/index.html loads /build/app.js)
import { mount } from "../lib/mount";
import { App } from "../components/App";

// Opening a page link directly (e.g. #perfume/...): keep the homepage hidden until that page is drawn,
// so it doesn't flash first
if (/^#(?:(?:perfume|profile|group|messages|all-reviews|edit-perfume|edit-group)\/.+|messages|groups|members|create-group|add-perfume|all-reviews|about|privacy|help)$/.test(location.hash)) {
  document.documentElement.classList.add("is-opening-view");
  setTimeout(() => document.documentElement.classList.remove("is-opening-view"), 5000);
}

mount(App);
