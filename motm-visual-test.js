const testPlayerSelect=document.querySelector('[name="playerId"]');
const testShirtNumber=document.querySelector('[name="shirtNumber"]');

testPlayerSelect?.addEventListener('change',()=>{
  const selected=testPlayerSelect.options[testPlayerSelect.selectedIndex];
  if(testShirtNumber&&selected?.dataset.shirtNumber)testShirtNumber.value=selected.dataset.shirtNumber;
});
