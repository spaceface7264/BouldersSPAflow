import React from 'react'
import Header from './components/Header'

function App() {
  return (
    <div className="min-h-screen bg-boulders-dark">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            BLIV MEDLEM
          </h1>
          <p className="text-xl text-gray-300">
            Velkommen til Boulders
          </p>
        </div>
      </main>
    </div>
  )
}

export default App

