import { cookies } from "next/headers";
import { CSRF_COOKIE_NAME, CSRF_FORM_FIELD, CSRF_HEADER_NAME } from "@/lib/csrf-core";

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

async function assertCsrfTokenValue(token: string | null | undefined) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieValue || !token) {
    throw new Error("Token CSRF manquant.");
  }
  if (!safeEqual(cookieValue, token)) {
    throw new Error("Token CSRF invalide.");
  }
}

export async function assertCsrfToken(formData: FormData) {
  const token = formData.get(CSRF_FORM_FIELD);
  if (typeof token !== "string") {
    throw new Error("Token CSRF manquant.");
  }
  await assertCsrfTokenValue(token);
}

export async function assertCsrfHeader(request: Request) {
  const token = request.headers.get(CSRF_HEADER_NAME);
  await assertCsrfTokenValue(token);
}
