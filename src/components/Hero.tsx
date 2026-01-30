import React from 'react';
import { Link } from 'react-router-dom';

export const Hero: React.FC = () => {
  return (
    <div className="min-h-screen bg-boulders-dark relative overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-boulders-purple/20 via-boulders-dark to-boulders-magenta/20"></div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-boulders-purple/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-boulders-magenta/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white mb-6 leading-tight">
            KLATRING &{' '}
            <span className="bg-gradient-to-r from-boulders-purple to-boulders-magenta bg-clip-text text-transparent">
              BOULDERING
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Join Your Bouldering Network. Experience world-class climbing facilities, 
            expert coaching, and a vibrant community of climbers.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              to="/signup"
              className="px-8 py-4 bg-gradient-to-r from-boulders-purple to-boulders-magenta text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-boulders-purple/50 transition-all duration-300 transform hover:scale-105"
            >
              Bliv Medlem
            </Link>
            <Link
              to="/signup"
              className="px-8 py-4 bg-transparent border-2 border-boulders-purple text-white font-semibold rounded-lg hover:bg-boulders-purple/10 transition-all duration-300"
            >
              Se Medlemskaber
            </Link>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-boulders-purple/50 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-boulders-purple to-boulders-magenta rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Moderne Haller</h3>
              <p className="text-gray-400">State-of-the-art climbing facilities with diverse routes for all skill levels</p>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-boulders-purple/50 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-boulders-purple to-boulders-magenta rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Fællesskab</h3>
              <p className="text-gray-400">Connect with fellow climbers and join a supportive community</p>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-boulders-purple/50 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-boulders-purple to-boulders-magenta rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Ekspert Coaching</h3>
              <p className="text-gray-400">Learn from experienced instructors and improve your technique</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
