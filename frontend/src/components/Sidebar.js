// /src/components/Sidebar.js
/*export default function Sidebar() {
  return (
    <aside style={{width: 200, background: '#eee', padding: '1rem'}}>
      Sidebar<br />Links/Navigation
    </aside>
  );
}*/

import { Link } from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside style={{width: 200, background: '#eee', padding: '1rem'}}>
      <div>Sidebar</div>
      <nav>
        <ul style={{listStyle: 'none', padding: 0}}>
          <li>
            <Link to="/">Dashboard</Link>
          </li>
          <li>
            <Link to="/upload">Upload Document</Link>
          </li>
          {/* Add more links as your app grows */}
        </ul>
      </nav>
    </aside>
  );
}



