$.getJSON('data/talks.json', function (data) {
    const flattenedTalks = [];
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
        collectionOfFocusedTalks+=single
    })
    setUI(collectionOfFocusedTalks);
});

function setUI(ui){
    document.getElementById("focused-talks-box").innerHTML = ui;
}