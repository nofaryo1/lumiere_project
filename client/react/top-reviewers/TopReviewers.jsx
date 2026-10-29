import { React } from "../shared/react";
import { useTopReviewers } from "./useTopReviewers";
import { PanelHeader } from "./PanelHeader";
import { ReviewerList } from "./ReviewerList";

export function TopReviewers() {
  const { reviewers, error, session, pending, follow } = useTopReviewers();
  return (
    <div className="panel">
      <PanelHeader />
      <ReviewerList reviewers={reviewers} error={error} session={session} pending={pending} onFollow={follow} />
    </div>
  );
}
