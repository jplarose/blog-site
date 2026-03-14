export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 mt-16 py-8">
      <div className="mx-auto max-w-4xl px-4 text-center text-sm text-gray-400">
        &copy; {new Date().getFullYear()} BlogSite. All rights reserved.
      </div>
    </footer>
  );
}
