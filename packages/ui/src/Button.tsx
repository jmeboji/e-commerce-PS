import React from 'react';

export function Button({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        backgroundColor: '#0070f3',
        color: '#fff',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
}
