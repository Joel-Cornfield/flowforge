import { NavLink } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <span className="brand-icon">⚡</span>
                <span>FlowForge</span>
            </div>

            <div className="navbar-links">
                <NavLink to="/" end>
                    Workflows
                </NavLink>

                <NavLink to="/integrations">
                    Integrations
                </NavLink>
            </div>
        </nav>
    );
}

export default Navbar;