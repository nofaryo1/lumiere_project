import { React, ReactDOM } from "../shared/react";
import { VideoBanner } from "./VideoBanner";

const container = document.getElementById("videoBannerRoot");
if (container) ReactDOM.createRoot(container).render(<VideoBanner />);
