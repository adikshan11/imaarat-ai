if (/^#(new|paper|how|status|quality|integrations)\b/.test(location.hash) || /[?&]dev=/.test(location.search)) location.replace('/app/' + location.search + location.hash)
