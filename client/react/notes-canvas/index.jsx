import { mountNotesCanvases } from "./mountNotesCanvases";

// main.js calls window.LumiereNotesCanvas.mountAll(scope) after it renders a page
window.LumiereNotesCanvas = { mountAll: mountNotesCanvases };
