import React from 'react'

export const Card: React.FC<{ title?: string; children?: React.ReactNode; className?: string }> = ({ title, children, className }) => {
  return (
    <div className={`card ${className ?? ''}`}>
      {title && <h3 className="card-title">{title}</h3>}
      <div className="card-body">{children}</div>
    </div>
  )
}

export default Card
