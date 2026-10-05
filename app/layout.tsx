import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazon Image Requirements Checker",
  description: "Check your main product photo against Amazon's image requirements, free.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site">
          <div className="wrap">
            Unofficial tool built by{" "}
            <a href="https://ankita-1402.vercel.app/" target="_blank" rel="noopener">
              Ankita Agarwal
            </a>{" "}
            as a work sample. Not affiliated with Photoroom or Amazon. Rules summarised from Amazon Seller Central help (October 2026); check
            Seller Central for the latest. Photo fixes use the Photoroom API.
          </div>
        </footer>
      </body>
    </html>
  );
}
