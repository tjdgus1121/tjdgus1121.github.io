(() => {
    "use strict";

    const activities = [
        ["activity0_textgame.html", "0", "핵심 단어 뽑기"],
        ["activity1_tfidf.html", "1", "TF-IDF 분석"],
        ["activity2_similarity.html", "2", "유사도 분석"],
        ["activity3_quiz.html", "3", "코사인 단어 잇기"],
        ["activity4_similiarityprc.html", "4", "유사도 계산하기"],
        ["activity5_jaccard.html", "5", "자카드 기초 활동"]
    ];

    function createActivityLink([file, index, label], currentFile) {
        const isCurrent = file === currentFile;
        return `
            <a${isCurrent ? ' class="is-current" aria-current="page"' : ""} href="./${file}">
                <span class="activity-menu-index">${index}</span><span>${label}</span>
            </a>`;
    }

    function mountActivityMenu() {
        if (!document.body || document.getElementById("activityMenu")) return;

        const currentFile = decodeURIComponent(location.pathname.split("/").pop() || "");
        const menu = document.createElement("details");
        menu.id = "activityMenu";
        menu.className = "activity-menu";
        menu.innerHTML = `
            <summary class="activity-menu-toggle">
                <span class="activity-menu-lines" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="activity-menu-sr-only">텍스트 탐구 활동 메뉴 열기</span>
            </summary>
            <div class="activity-menu-panel">
                <div class="activity-menu-heading">
                    <strong>텍스트 탐구 활동</strong>
                    <small>원하는 활동으로 바로 이동하세요.</small>
                </div>
                <nav class="activity-menu-links" aria-label="텍스트 탐구 활동">
                    <a class="activity-menu-home" href="./indextext.html">
                        <span aria-hidden="true">←</span><span>활동 목록</span>
                    </a>
                    ${activities.map(activity => createActivityLink(activity, currentFile)).join("")}
                    <a href="https://jaccard.pages.dev/">
                        <span class="activity-menu-index">J</span><span>자카드 감정 실험실</span>
                    </a>
                    <a class="activity-menu-home" href="../index.html">
                        <span aria-hidden="true">⌂</span><span>전체 활동 홈</span>
                    </a>
                </nav>
            </div>`;

        document.body.insertBefore(menu, document.body.firstChild);

        document.addEventListener("click", event => {
            if (menu.open && !menu.contains(event.target)) menu.open = false;
        });

        document.addEventListener("keydown", event => {
            if (event.key !== "Escape" || !menu.open) return;
            menu.open = false;
            menu.querySelector("summary")?.focus();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountActivityMenu, { once: true });
    } else {
        mountActivityMenu();
    }
})();
