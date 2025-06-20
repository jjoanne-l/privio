import React from 'react';
import './LoadingAnimation.css';

const LoadingAnimation = () => {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-circles">
          <div className="circle circle-1"></div>
          <div className="circle circle-2"></div>
          <div className="circle circle-3"></div>
          <div className="circle circle-4"></div>
        </div>
        <div className="loading-icon">
          <svg viewBox="0 0 24 24" width="96" height="96">
            <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </div>
        <div className="loading-text">
          <span>P</span>
          <span>r</span>
          <span>i</span>
          <span>v</span>
          <span>i</span>
          <span>o</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingAnimation; 