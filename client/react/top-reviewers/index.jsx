import { React, ReactDOM } from "../shared/react";
import { app } from "../shared/lumiere";
import { TopReviewers } from "./TopReviewers";

const container = document.getElementById("topReviewersRoot");
if (container && app) ReactDOM.createRoot(container).render(<TopReviewers />);
