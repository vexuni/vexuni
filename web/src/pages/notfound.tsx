import { Link } from "react-router-dom";
import { useT } from "../lib/i18n";
import { Shell } from "../components/layout";
import { Empty } from "../components/ui";

export function NotFoundPage() {
  const { t } = useT();
  return (
    <Shell crumbs={[{ label: "404" }]}>
      <div className="panel">
        <Empty
          icon="search"
          title={t("err.notFound")}
          body={t("err.notFoundBody")}
          action={
            <Link className="btn primary" to="/">
              {t("err.backHome")}
            </Link>
          }
        />
      </div>
    </Shell>
  );
}
