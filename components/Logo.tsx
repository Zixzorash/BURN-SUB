import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-4 select-none ${className}`}>
      {/* JAV TH Styled Logo */}
      <div className="relative group cursor-pointer transform hover:scale-105 transition-transform duration-300">
        
        {/* Swirl / Speed lines background effect */}
        <div className="absolute -inset-4 bg-jav-yellow rounded-full blur-xl opacity-20 group-hover:opacity-40 animate-pulse"></div>
        
        <div className="relative flex items-end">
          {/* JAV Text */}
          <div className="relative z-10">
            <span className="text-6xl font-black italic tracking-tighter text-jav-red" 
                  style={{ 
                    textShadow: '3px 3px 0px #000, -1px -1px 0 #fff',
                    fontFamily: '"Kanit", sans-serif',
                    WebkitTextStroke: '1px black'
                  }}>
              JAV
            </span>
            
            {/* Swirl overlay simulation */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="w-[120%] h-2 bg-jav-yellow absolute top-4 -left-2 transform -rotate-12 border-y border-black"></div>
                <div className="w-[120%] h-1 bg-black absolute bottom-2 -left-2 transform -rotate-6"></div>
            </div>
          </div>

          {/* TH Badge */}
          <div className="relative mb-2 -ml-2 z-20 transform rotate-6">
             <div className="bg-gradient-to-br from-jav-red to-red-800 text-white text-2xl font-black px-2 py-0.5 border-2 border-white shadow-[2px_2px_0px_#000] skew-x-[-10deg]">
               TH
             </div>
          </div>
        </div>
      </div>

      <div className="hidden md:flex flex-col justify-center border-l-2 border-jav-gray pl-4 h-12">
        <h1 className="text-lg font-bold text-white uppercase tracking-[0.2em] leading-none">Subtitle<span className="text-jav-yellow">Burner</span></h1>
        <p className="text-[10px] text-jav-red font-semibold tracking-wider mt-1">HIGH PERFORMANCE TOOL</p>
      </div>
    </div>
  );
};