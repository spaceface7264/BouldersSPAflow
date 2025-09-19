import React from 'react'

const Header: React.FC = () => {
  return (
    <header className="w-full bg-boulders-dark border-b border-gray-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            {/* Boulders Logo - Using text for now, can be replaced with actual logo */}
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-boulders-magenta rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-xl md:text-2xl tracking-tight">
                  BOULDERS
                </span>
                <span className="text-gray-400 text-xs md:text-sm -mt-1">
                  KLATRING & BOULDERING
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
              Medlemskab
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
              Haller
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
              Kurser
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
              Om os
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-gray-300 hover:text-white transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header

