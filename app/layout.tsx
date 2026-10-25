import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VisualiseUi",
  description: "For the purpose of testing components",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
