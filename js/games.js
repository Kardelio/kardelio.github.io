$.getJSON('games.json', function (data) {
    let out = "";
    data.games.forEach(element => {
        const players = element.minplayers === element.maxplayers
            ? element.minplayers
            : `${element.minplayers}-${element.maxplayers}`;
        const meta = [
            `${players} players`,
            element.playtime ? `${element.playtime} min` : null,
            element.yearpublished
        ].filter(Boolean).join(" · ");
        out += `
            <div class="game-box">
                <img class="game-thumb" src="${element.thumbnail}" alt=""/>
                <div class="game-title">${element.name}</div>
                <div class="game-meta">${meta}</div>
            </div>
        `
    });
    document.getElementById("games-container").innerHTML = out;
});
