import { NoticeBanner } from "./ui";

export default function ValidationAlert({ warning }) {
  if (!warning) return null;
  return <NoticeBanner notice={{ type: "warning", message: <><strong className="block">Cảnh báo khoảng cách tới ga Metro (&gt;1.5 km)</strong>{warning}</> }} />;
}
