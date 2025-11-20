import React from 'react'
import { NavLink } from 'react-router-dom'

function Item({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "block px-3 py-2 rounded hover:bg-slate-100 " + (isActive ? "bg-slate-100 font-medium" : "text-slate-700")
      }
    >
      {children}
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <div className="sticky top-4 bg-white p-4 rounded shadow">
      <nav className="space-y-1">
        <Item to="/dashboard">Overview</Item>
        <Item to="/search">Search</Item>
        <Item to="/chat">Chat</Item>
        <Item to="/documents">Documents</Item>
        <Item to="/documents/upload">Upload</Item>
        <Item to="/settings">Settings</Item>
      </nav>
    </div>
  )
}
