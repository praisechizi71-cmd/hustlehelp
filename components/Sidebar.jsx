export default function Sidebar() {
  return (
    <aside className="w-full md:w-64 bg-[#1d1233] p-5 flex flex-col">

      {/* Logo */}
      <h1 className="text-2xl font-bold text-purple-300">
        HustleHelp
      </h1>

      {/* Navigation */}
      <nav className="mt-6 flex flex-row md:flex-col gap-3 text-sm overflow-x-auto">

        <button className="text-left bg-purple-600 px-4 py-3 rounded-xl">
          Customers
        </button>

        <button className="text-left px-4 py-3 rounded-xl hover:bg-purple-800">
          Analytics
        </button>

        <button className="text-left px-4 py-3 rounded-xl hover:bg-purple-800">
          Settings
        </button>

      </nav>

    </aside>
  );
}