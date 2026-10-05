import React from 'react'

export const Card: React.FC<{ title?: string; children?: React.ReactNode; className?: string }> = ({ title, children, className }) => {
  return (
    <div className={`card ${className ?? ''}`}>
      {title && <h2 className="card-title">{title}</h2>}
      <div className="card-body">{children}</div>
    </div>
  )
}

export default Card
