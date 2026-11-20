import { useEffect, useRef, useState } from 'react';
import character from './characterProfile.json';
import { expression } from './assets';
import { Icon } from './Icon';

const concepts = [
  { label: '日常服', path: '/assets/elise/concept/1.png', alt: '日常服的正面、側面與背面設定圖' },
  { label: '泳裝', path: '/assets/elise/concept/2.png', alt: '藍色泳裝的正面、側面與背面設定圖' },
];

const details = [
  { label: '年齡', value: `${character.age} 歲` },
  { label: '身份', value: character.occupation },
  { label: '身高', value: `${character.heightCm} cm` },
  { label: '體重', value: `${character.weightKg} kg` },
  { label: '三圍', value: `${character.measurementsCm} cm` },
];

export function CharacterProfile({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const concept = concepts[selected];
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);

  return (
    <section className="deepseek-panel character-profile" role="dialog" aria-labelledby="profile-title"
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <header className="profile-header">
        <span className="profile-mark"><Icon name="bookmark" size={21} /></span>
        <h2 id="profile-title">角色設定檔</h2>
        <button ref={closeButton} type="button" className="icon-button" aria-label="關閉角色設定檔" onClick={onClose}>
          <Icon name="close" size={12} />
        </button>
      </header>
      <div className="profile-content" tabIndex={0} role="region" aria-label={`${character.name}的資料與概念圖`}>
        <div className="profile-identity">
          <h3>{character.name}</h3>
          <p><span lang="ja">{character.reading}</span><span lang="en">{character.romanized}</span></p>
        </div>

        <div className="profile-gallery">
          <div className="profile-gallery-options" role="group" aria-label="概念圖">
            {concepts.map((item, index) => (
              <button key={item.path} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
                {item.label}
              </button>
            ))}
          </div>
          <img src={concept.path} alt={`${character.name} ${concept.alt}`} width={1448} height={1086} draggable={false} />
        </div>

        <section className="profile-section" aria-labelledby="profile-details">
          <h3 id="profile-details">基本資料</h3>
          <dl className="profile-details">
            {details.map(detail => (
              <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>
            ))}
            <div>
              <dt>罩杯</dt>
              <dd className="profile-private">
                <span className="avatar profile-shy" style={{ backgroundImage: `url(${expression('shy')})` }} aria-hidden="true" />
                {character.cup}
              </dd>
            </div>
          </dl>
        </section>
        <section className="profile-section" aria-labelledby="profile-intro">
          <h3 id="profile-intro">自我介紹</h3>
          <p>{character.introduction}</p>
        </section>
      </div>
    </section>
  );
}
