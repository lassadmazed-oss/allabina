import Link from 'next/link'
import '../../landing.css'
import { isLocale, type Locale } from '@/lib/i18n'
import { landingCopy } from '@/components/landing/copy'
import { PHOTOS } from '@/components/landing/photos'
import SfaxMap, { SFAX_MAPS_URL } from '@/components/landing/SfaxMap'
import StickyCta from '@/components/landing/StickyCta'
import VideoModal from '@/components/landing/VideoModal'
import {
  IcArrow,
  IcBuilding,
  IcFlag,
  IcHome,
  IcLeaf,
  IcPin,
  IcPlay,
  IcShield,
  IcUsers,
} from '@/components/landing/icons'

/* eslint-disable @next/next/no-img-element -- صور ثابتة في public/landing */

/**
 * صفحة الاستقبال — هوية اللبنة الجديدة: كحلي/ذهبي/كريمي، خطّ Cairo،
 * صور حقيقية لكلّ قسم، وزرّ ثابت على الهاتف. النصوص في components/landing/copy.ts.
 */
const TILE_STYLE = ['blue', 'sand', 'mint', 'blush'] as const
const TILE_COLOR = ['#0E3A5B', '#8A5A1E', '#2E7D4F', '#B0433A'] as const

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const c = landingCopy[locale]
  const p = (s = '') => `/${locale}${s}`

  const tileIcons = [<IcBuilding key="b" />, <IcHome key="h" />, <IcLeaf key="l" />, <IcUsers key="u" />]
  const statIcons = [<IcShield key="s" />, <IcPin key="p" />, <IcHome key="h" />, <IcLeaf key="l" />]
  const featIcons = [<IcShield key="s" />, <IcUsers key="u" />, <IcFlag key="f" />]

  return (
    <div className="lp">
      {/* الواجهة */}
      <section className="hero" id="top">
        <div className="hero__media">
          <img src={PHOTOS.hero} alt={c.hero.alt} fetchPriority="high" />
        </div>
        <div className="hero__shade" aria-hidden="true" />
        <div className="wrap hero__in">
          <div className="hero__txt">
            <h1>{c.hero.title}</h1>
            <div className="hero__sub">{c.hero.sub}</div>
            <p className="hero__p">{c.hero.text}</p>
            <div className="hero__cta">
              <Link href={p('/demande')} className="btn btn--navy">
                {c.hero.cta1}
                <IcArrow className="arr" />
              </Link>
              <VideoModal
                label={c.hero.cta2}
                title={c.hero.videoTitle}
                note={c.hero.videoNote}
                closeLabel={c.hero.close}
                src={PHOTOS.intro}
                poster={PHOTOS.introPoster}
              />
            </div>
            {/* «قدّاش تاخذو منّي؟» أوّل سؤال يوقف الناس — جوابه تحت الزرّ */}
            <p className="hero__free">{c.hero.free}</p>
            <div className="stats">
              {c.stats.map((s, i) => (
                <div className="stat" key={i}>
                  <span className="stat__i">{statIcons[i]}</span>
                  <span className="stat__t">
                    {s.n ? <span className="stat__n">{s.n}</span> : null}
                    <span className="stat__l">{s.l}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* خدماتنا */}
      <section className="wrap" id="services">
        <div className="card services">
          <div className="services__txt">
            <span className="eyebrow">{c.services.eyebrow}</span>
            <h2 className="sec-title">{c.services.title}</h2>
            <p className="lead">{c.services.text}</p>
            <Link href={p('/demande')} className="btn btn--navy">
              {c.services.cta}
              <IcArrow className="arr" />
            </Link>
          </div>
          <div className="tiles">
            {c.services.items.map((it, i) => (
              <Link key={it.href} href={p(it.href)} className={`tile tile--${TILE_STYLE[i]}`}>
                <span className="tile__ic" style={{ color: TILE_COLOR[i] }}>
                  {tileIcons[i]}
                </span>
                <h3>{it.t}</h3>
                <p>{it.d}</p>
                <span className="go">
                  <IcArrow className="arr" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* من نحن */}
      <section className="wrap about" id="about">
        <div className="photo-card">
          <img src={PHOTOS.about} alt={c.about.alt} loading="lazy" />
          <div className="photo-card__shade" aria-hidden="true" />
          <div className="script" aria-hidden="true">
            {c.about.script}
          </div>
          <Link href={p('/realisations')} className="play">
            <span className="play__b">
              <IcPlay />
            </span>
            {c.about.photoCta}
          </Link>
        </div>
        <div className="about__txt">
          <span className="eyebrow">{c.about.eyebrow}</span>
          <h2 className="sec-title">{c.about.title}</h2>
          <p className="lead">{c.about.text}</p>
          <p className="about__tag">{c.about.tagline}</p>
          <div className="feats">
            {c.about.feats.map((f, i) => (
              <div className="feat" key={f}>
                <span className="ic">{featIcons[i]}</span>
                {f}
              </div>
            ))}
          </div>
          <Link href={p('/a-propos')} className="btn btn--navy btn--sm">
            {c.about.cta}
            <IcArrow className="arr" />
          </Link>
        </div>
        <div className="about__map">
          <SfaxMap locale={locale} title={c.about.mapFrameTitle} />
          <div className="map__cap">
            <b>{c.about.mapTitle}</b>
            <span>{c.about.mapSub}</span>
            <a href={SFAX_MAPS_URL} target="_blank" rel="noopener noreferrer">
              {c.about.mapOpen}
            </a>
          </div>
        </div>
      </section>

      {/* كيف نعمل */}
      <section className="wrap how" id="how">
        <span className="eyebrow">{c.how.eyebrow}</span>
        <h2 className="sec-title">{c.how.title}</h2>
        <ol className="steps">
          {c.how.steps.map((s, i) => (
            <li className="step" key={s.t}>
              {PHOTOS.steps[i] ? (
                <div className="step__img">
                  <img src={PHOTOS.steps[i]} alt="" loading="lazy" />
                </div>
              ) : null}
              <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* مشاريعنا */}
      <section className="wrap projects" id="projects">
        <div className="sec-head">
          <div>
            <span className="eyebrow">{c.projects.eyebrow}</span>
            <h2 className="sec-title">{c.projects.title}</h2>
            <p className="lead">{c.projects.text}</p>
          </div>
          <Link href={p('/realisations')} className="linkarrow">
            {c.projects.all}
            <IcArrow className="arr" />
          </Link>
        </div>
        <div className="pgrid">
          {c.projects.items.map((it, i) => (
            <Link key={it.href} href={p(it.href)} className="pcard">
              <img src={PHOTOS.projects[i]} alt={it.t} loading="lazy" />
              <div className="pcard__shade" aria-hidden="true" />
              <div className="pcard__txt">
                <div>
                  <b>{it.t}</b>
                  <small>{it.l}</small>
                </div>
                <span className="go">
                  <IcArrow className="arr" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <StickyCta href={p('/demande')} label={c.sticky.cta} />
    </div>
  )
}
