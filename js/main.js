$.getJSON('data/talks.json', function (data) {
    const flattenedTalks = [];
    let ltview = "";
    data.linktrees.forEach(lt => {
        console.log(lt)
        if (lt.link != null) {
            ltview += `
            <div class="linktree-box" onclick="goToLinktree('${lt.link}')" >
                <img class="linktree-img linktree-green"src="media/icon-lt.webp"/> 
                ${lt.title}
            </div>
        `
        }
    });
    data.talksInYears.forEach(yearData => {
        const year = yearData.year;
        yearData.talks.forEach(talk => {
            flattenedTalks.push({
                ...talk,
                yearPerformed: year
            });
        });
    });
    let collectionOfFocusedTalks = "";
    data.focusedTalks.forEach(title => {
        let filteredTalks = flattenedTalks.filter(a => a.title === title)
        let performanceCount = filteredTalks.length;
        console.log(performanceCount)
        const uniqueYearsOneLiner = [...new Set(filteredTalks.map(talk => talk.yearPerformed))];
        console.log(uniqueYearsOneLiner)
        let single = `
            <div class="single-focused-talk-container">
                <div class="single-focused-talk-title">${title}</div>
                <div class="single-focused-talk-count">${performanceCount}</div>
                <div class="single-focused-talk-years">${uniqueYearsOneLiner}</div>
            </div>
        `;
        collectionOfFocusedTalks += single
    })
    setUI(collectionOfFocusedTalks, ltview);
});

function setUI(ui, lts) {
    document.getElementById("focused-talks-box").innerHTML = ui;
    document.getElementById("linktrees").innerHTML = lts;
}

function goToLinktree(link) {
    console.log("Going to: " + link)
    location.href = link
}