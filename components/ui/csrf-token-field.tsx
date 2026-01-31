"use client";

import { useEffect, useState } from "react";

const CSRF_COOKIE_NAME = "csrf_token";

function getCookieValue(name: string) {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return "";
}

export function CsrfTokenField() {
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(getCookieValue(CSRF_COOKIE_NAME));
  }, []);

  return <input type="hidden" name="csrfToken" value={token} readOnly />;
}
