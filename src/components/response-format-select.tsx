"use client";
import { useLanguage } from "./language-provider";
export function ResponseFormatSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <label>
      {t("응답 형식 (Accept)")}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="default">{t("서버 기본값")}</option>
        <option value="json">JSON</option>
        <option value="text">{t("일반 텍스트")}</option>
        <option value="html">HTML</option>
      </select>
      <small>
        {t(
          "요청할 응답 형식을 지정합니다. 실제 형식은 서버 응답에 따라 달라집니다.",
        )}
      </small>
    </label>
  );
}
