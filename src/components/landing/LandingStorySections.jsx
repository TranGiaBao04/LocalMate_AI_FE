import { useRef, useState } from "react";
import "./landingStory.css";

const SCENARIOS = [
  {
    id: "discover",
    tab: "Tìm chỗ đi",
    icon: "travel_explore",
    problemTitle: "Lưu cả chục quán. Vẫn chưa biết đi đâu.",
    problem: "Một chỗ trên TikTok, một chỗ trên bản đồ. Càng nhiều gợi ý, càng khó chọn nơi hợp gu và tiện đường.",
    solutionTitle: "Đúng gu bạn. Gần ga bạn đi.",
    solution: "Khám phá địa điểm quanh Metro số 1 trong cùng một nơi, kèm thông tin và khoảng cách tới ga để dễ chọn hơn.",
    stops: ["Cà phê", "Ăn uống", "Check-in"],
    result: "Địa điểm quanh ga, dễ tìm hơn",
  },
  {
    id: "plan",
    tab: "Lên kế hoạch",
    icon: "tune",
    problemTitle: "Chỉ rảnh một buổi. Lên lịch đã hết cả hứng.",
    problem: "Đi mấy chỗ thì vừa? Có vượt ngân sách không? Tự ghép một lịch trình hợp thời gian và sở thích thật sự không dễ.",
    solutionTitle: "Một lịch trình. Vừa vặn với bạn.",
    solution: "Chia sẻ thời gian rảnh, ngân sách và sở thích. AI gợi ý lịch trình theo giờ, kèm chi phí ước tính cho mỗi người.",
    stops: ["Thời gian", "Ngân sách", "Sở thích"],
    result: "Kế hoạch bắt đầu từ nhu cầu của bạn",
  },
  {
    id: "move",
    tab: "Sẵn sàng xuất phát",
    icon: "route",
    problemTitle: "Chọn được nơi rồi. Đi thế nào cho tiện?",
    problem: "Chưa biết ghé đâu trước, mỗi chặng đi bằng gì. Đổi một địa điểm lại phải loay hoay sắp xếp cả buổi đi chơi.",
    solutionTitle: "Rõ từng chặng. Chủ động từng điểm.",
    solution: "Xem cách di chuyển, thời gian mỗi chặng và mở chỉ đường Google Maps. Chưa ưng điểm nào, thay ngay trong bản nháp trước khi chốt.",
    stops: ["Chọn ga", "Xem chặng", "Chỉ đường"],
    result: "Xem trước, chỉnh lại, rồi hãy chốt",
  },
];

const MEMBERS = [
  { name: "Bảo", role: "Phát triển full-stack", tone: "blue", icon: "data_object" },
  { name: "Minh", role: "Phát triển full-stack", tone: "green", icon: "data_object" },
  { name: "Thịnh", role: "Phát triển full-stack", tone: "violet", icon: "data_object" },
  { name: "Huy", role: "Phát triển full-stack", tone: "rose", icon: "data_object" },
  { name: "Hoàng", role: "Truyền thông & Marketing", tone: "amber", icon: "campaign" },
];

function Icon({ children, className = "" }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function JourneyIllustration({ scenario }) {
  return (
    <div className="lm-journey" aria-hidden="true">
      <div className="lm-journey-topline">
        <span><Icon>train</Icon> METRO SỐ 1</span>
        <span className="lm-journey-note">Minh họa trải nghiệm</span>
      </div>
      <div className="lm-journey-stops">
        {scenario.stops.map((stop, index) => (
          <div className="lm-journey-stop" key={stop}>
            <span className={`lm-stop-dot lm-stop-dot-${index}`}>
              <Icon>{index === 0 ? "near_me" : index === 1 ? "favorite" : "flag"}</Icon>
            </span>
            <span>{stop}</span>
          </div>
        ))}
      </div>
      <p className="lm-journey-result"><Icon>check_circle</Icon>{scenario.result}</p>
    </div>
  );
}

export function LandingProblems({ onStart }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef([]);

  function handleTabKey(event, index) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % SCENARIOS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + SCENARIOS.length) % SCENARIOS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = SCENARIOS.length - 1;
    else return;
    event.preventDefault();
    setActiveIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section id="van-de-giai-phap" aria-labelledby="problem-solution-heading" className="lm-story lm-problems">
      <div className="lm-story-container">
        <div className="lm-section-intro">
          <div>
            <p className="lm-eyebrow"><span /> Vấn đề &amp; giải pháp</p>
            <h2 id="problem-solution-heading" className="lm-editorial-heading">
              Bớt lo kế hoạch.<br /><span>Thêm vui hành trình.</span>
            </h2>
          </div>
          <p className="lm-intro-copy">
            Một buổi đi chơi nên bắt đầu bằng sự hào hứng.
            LocalMate AI giúp những băn khoăn quen thuộc trở nên nhẹ nhàng hơn.
          </p>
        </div>

        <div className="lm-scenario-tabs" role="tablist" aria-label="Bạn đang băn khoăn điều gì?">
          {SCENARIOS.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`lm-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              aria-controls={`lm-panel-${item.id}`}
              tabIndex={activeIndex === index ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleTabKey(event, index)}
              className="lm-scenario-tab"
            >
              <Icon>{item.icon}</Icon>
              <span>{item.tab}</span>
              <span className="lm-tab-number">0{index + 1}</span>
            </button>
          ))}
        </div>

        {SCENARIOS.map((item, index) => (
          <div
            key={item.id}
            id={`lm-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`lm-tab-${item.id}`}
            hidden={activeIndex !== index}
            tabIndex={0}
            className="lm-scenario-panel"
          >
            {activeIndex === index && (
              <div className="lm-scenario-layout">
                <div className="lm-before">
                  <span className="lm-panel-label"><span className="lm-status-dot" /> Bạn có từng…</span>
                  <div className="lm-before-content">
                    <span className="lm-question-mark" aria-hidden="true">?</span>
                    <h3>{item.problemTitle}</h3>
                    <p>{item.problem}</p>
                  </div>
                  <p className="lm-before-footnote">Một chút lăn tăn trước mỗi lần xuống phố.</p>
                </div>
                <div className="lm-after">
                  <span className="lm-panel-label"><Icon>auto_awesome</Icon> Cùng LocalMate AI</span>
                  <h3>{item.solutionTitle}</h3>
                  <p className="lm-solution-copy">{item.solution}</p>
                  <JourneyIllustration scenario={item} />
                  <button type="button" onClick={onStart} className="lm-story-action">
                    Lên lịch trình của bạn <Icon>arrow_forward</Icon>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        <p className="lm-scenario-hint"><Icon>touch_app</Icon> Chọn một tình huống để xem LocalMate giúp bạn thế nào.</p>
      </div>
    </section>
  );
}

export function LandingTeam() {
  return (
    <section id="doi-ngu" aria-labelledby="team-heading" className="lm-story lm-team">
      <div className="lm-story-container">
        <div className="lm-section-intro">
          <div>
            <p className="lm-eyebrow"><span /> Đội ngũ LocalMate AI</p>
            <h2 id="team-heading" className="lm-editorial-heading">
              Chúng mình là<br /><span>LocalMate.</span>
            </h2>
          </div>
          <div className="lm-intro-copy">
            <p className="lm-team-lead">Năm thành viên. Một hành trình chung.</p>
            <p>Bốn người phát triển sản phẩm, một người phụ trách truyền thông và marketing. Cùng đưa LocalMate AI đến gần hơn với những người thích khám phá Sài Gòn.</p>
          </div>
        </div>

        <div className="lm-team-layout">
          <figure className="lm-team-postcard">
            <img
              src="/landing/stations/station-03.webp"
              alt="Lối vào ga Metro Ba Son tại TP. Hồ Chí Minh lúc chiều xuống"
              width="2000"
              height="1335"
              loading="lazy"
            />
            <span className="lm-postcard-location"><Icon>location_on</Icon> Sài Gòn, Việt Nam</span>
            <figcaption>
              <span className="lm-postcard-kicker">Từ một điểm dừng, mở ra nhiều trải nghiệm</span>
              <p>Một thành phố quen.<br />Nhiều điều để khám phá.</p>
              <span className="lm-postcard-caption"><Icon>train</Icon> Ga Ba Son · Metro số 1</span>
            </figcaption>
          </figure>

          <div className="lm-team-roster">
            <div className="lm-roster-heading"><span>Những người đồng hành</span><span>01 — 05</span></div>
            <ul aria-label="Năm thành viên LocalMate AI">
              {MEMBERS.map((member, index) => (
                <li key={member.name} className={`lm-member lm-member-${member.tone}`}>
                  <span className="lm-member-stop" aria-hidden="true">0{index + 1}</span>
                  <div className="lm-member-identity">
                    <h3>{member.name}</h3>
                    <p>{member.role}</p>
                  </div>
                  <span className="lm-member-specialty" aria-hidden="true"><Icon>{member.icon}</Icon></span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lm-team-contact">
          <div>
            <p className="lm-contact-title">Có điều muốn kể? Tụi mình nghe đây.</p>
            <p>Góp ý, gợi ý một điểm đến hay cùng tạo nên điều gì đó thú vị.</p>
          </div>
          <a href="mailto:localmateai@gmail.com" className="lm-contact-link">
            Trò chuyện với LocalMate <span><Icon>north_east</Icon></span>
          </a>
        </div>
      </div>
    </section>
  );
}
