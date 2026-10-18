import { CheckCircle2, CircleHelp, Link2, Plus } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

export function SocialConnectionGuide() {
  return (
    <section className="quiet-panel social-connection-guide" aria-labelledby="social-connection-guide-title">
      <div className="section-heading social-connection-guide__heading">
        <div>
          <p className="kicker">Connection guide</p>
          <h3 id="social-connection-guide-title">Connect your social accounts</h3>
          <p className="muted">
            Add one account record for each page or profile, then authorize the accounts that should
            sync and publish from Content.
          </p>
        </div>
        <span className="inline-chip"><Link2 size={14} /> Live connections</span>
      </div>

      <div className="social-connection-guide__steps">
        <article className="social-guide-step">
          <div className="social-guide-step__number">1</div>
          <div>
            <h4>Add an account record</h4>
            <p>Choose the platform, name the page or profile, and link it to the correct brand profile.</p>
            <p className="muted">Repeat this for every Facebook Page, Instagram profile, or planning-only channel.</p>
          </div>
        </article>
        <article className="social-guide-step">
          <div className="social-guide-step__number">2</div>
          <div>
            <h4>Authorize Meta accounts</h4>
            <p>For Facebook and Instagram, select <strong>Connect Meta</strong> beside the account you want to use.</p>
            <p className="muted">Meta will return the page and account IDs and store the authorization securely.</p>
          </div>
        </article>
        <article className="social-guide-step">
          <div className="social-guide-step__number">3</div>
          <div>
            <h4>Sync and verify</h4>
            <p>After authorization, choose <strong>Sync posts</strong> to import live posts and available analytics.</p>
            <p className="muted">Use View to check permissions, last sync, market, and connection status.</p>
          </div>
        </article>
      </div>

      <div className="social-connection-guide__columns">
        <div className="social-guide-checklist">
          <div className="social-guide-checklist__title"><CheckCircle2 size={16} /><strong>Before connecting Meta</strong></div>
          <ul>
            <li>You have admin access to the Facebook Page.</li>
            <li>The Instagram account is Professional or Business and linked to that Page.</li>
            <li>The account is linked to the right brand profile in its form.</li>
          </ul>
        </div>
        <div className="social-guide-platforms">
          <div className="social-guide-checklist__title"><CircleHelp size={16} /><strong>What is live today?</strong></div>
          <div className="social-guide-platforms__row"><span><strong>Facebook / Instagram</strong><small>OAuth, sync, analytics, and publishing via Meta</small></span><StatusBadge label="active" /></div>
          <div className="social-guide-platforms__row"><span><strong>LinkedIn / X / TikTok / YouTube</strong><small>Save a planning record while live connectors are being added</small></span><span className="inline-chip">Planning</span></div>
        </div>
      </div>

      <div className="social-connection-guide__note">
        <Plus size={16} />
        <span><strong>Connecting multiple accounts:</strong> add each account separately, link each to its brand, and authorize only the accounts you want Content to publish to. They will remain separate in the table so you can sync or reconnect them individually.</span>
      </div>
    </section>
  );
}
