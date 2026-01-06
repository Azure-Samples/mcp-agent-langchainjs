window.setup = function() {
  window.annotations = [];
  window.oldannotations = [];
  window.slideshow.on('beforeShowSlide', function (slide) {
    window.oldannotations = window.annotations;
    window.annotations = [];
  });
  window.slideshow.on('afterShowSlide', function (slide) {
    const element = document.querySelector('.remark-visible .remark-slide-content');
    element.childNodes
      .filter(node => node.nodeName === "SCRIPT")
      .forEach(node => {
        eval(node.innerHTML);
      });
    setTimeout(function() {
      window.oldannotations.forEach((annotation) => {
        annotation.remove();
      });
      window.oldannotations = [];
    }, 0);
  });
}

function rough(selector, options, delay = 500) {
  setTimeout(function() {
    document
      .querySelectorAll(`.remark-visible ${selector}`)
      .forEach((e) => {
        const annotation = RoughNotation.annotate(e, options);
      
        // Keep track of annotation to remove it on slide change
        window.annotations.push(annotation);
      
        // Fix scale
        const scaler = document.querySelector('.remark-slide-scaler');
        const scale = Number(/scale\((\d+\.?\d*)\)/.exec(scaler.style.transform)[1]);
        annotation._svg.style.transform = `scale(${1/scale})`;
      
        annotation.show();
      });
  }, delay);
}
