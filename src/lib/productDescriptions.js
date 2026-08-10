const productDescriptionFallbacks = {
  '2-Drawer Desktop Organizer':
    'A compact two-drawer organizer for keeping small desk or household items together. See the actual photo for its design and packaging.',
  'ANEW 3PC Pouch Set':
    'A coordinated three-piece pouch set for organizing small essentials at home or while out and about.',
  'Maurice Crossbody Bag':
    'A compact crossbody bag for hands-free everyday carrying. See the actual photo for its color, shape, and design.',
  'Macy 2PC Bag Set':
    'A coordinated two-piece bag set that offers flexible options for carrying everyday essentials.',
  'True Flap Cosmetic Pouch':
    'A compact flap-style cosmetic pouch for keeping makeup and other small personal items together.',
  'FD Incentive Prize Wristlet':
    'A compact wristlet for carrying small essentials in an easy-to-hold format.',
  'Carolyn Wallet with Sling':
    'A wallet with a sling for carrying cards, cash, and other small essentials by hand or over the shoulder.',
  'Crissy Multi Compartment Compact Sling':
    'A compact sling bag with multiple compartments to help separate everyday essentials.',
  'Fresh Stripes Pouch':
    'A striped pouch for organizing small everyday items inside a larger bag or at home.',
  'Fruity Paradise Pouch':
    'A compact pouch with a playful Fruity Paradise design for keeping small essentials together.',
  'True Handy Cosmetic Pouch':
    'A handy cosmetic pouch for keeping makeup, toiletries, or other small personal items organized.',
  'Soft Musk Triple Compartment Wristlet Pouch':
    'A wristlet pouch with three compartments for separating small personal items and everyday essentials.',
  'Cherish 2-Way Wristlet Clutch':
    'A two-way wristlet clutch that offers a compact option for carrying everyday essentials.',
  'Shiloh Wallet with Sling':
    'A wallet with a sling for carrying cards, cash, and small essentials in a compact format.',
  'Cathy Multipurpose Wallet':
    'A multipurpose wallet for keeping cards, cash, and other small essentials together.',
  'Foldable Organizer (Pink)':
    'A pink foldable organizer for keeping small household or personal items together when needed.',
  'Avon Reusable Bag':
    'A reusable Avon bag for everyday carrying, errands, or keeping extra items together.',
  'Gloria Long Wallet with Sling':
    'A long wallet with a sling for carrying cards, cash, and small essentials by hand or over the shoulder.',
  'Chafing Dish':
    'A chafing dish for serving food during family meals, celebrations, and other gatherings.',
  'Sauté Pan':
    'A sauté pan suited to everyday stovetop cooking and a practical addition to the kitchen.',
  '3 PC Kitchen Tool Set':
    'A three-piece kitchen tool set for common food preparation and cooking tasks.',
  'Multi-Purpose Slicer and Grater with Container':
    'A multipurpose slicer and grater with a container to help collect ingredients during food preparation.',
  'Evergreen 8-PC Spoon and Fork Set':
    'A coordinated eight-piece spoon and fork set for everyday meals or additional place settings.',
  'Printed Kitchen Knife Set':
    'A coordinated printed kitchen knife set for common food preparation tasks.',
  '4 PC Cooking Utensils Set':
    'A four-piece cooking utensil set for common mixing, serving, and food preparation tasks.',
  'Grate and Store':
    'A practical grating tool with storage to help keep prepared ingredients together.',
  'Glass Rack':
    'A rack for keeping drinking glasses arranged and easier to store in the kitchen or dining area.',
  '4 PC Square Tumbler':
    'A coordinated four-piece square tumbler set for serving everyday drinks.',
  'Blushing Blooms 4 Piece Mug Set':
    'A four-piece mug set with a floral Blushing Blooms design for hot or cold drinks.',
  '4PCS Celebrate Festive Cup':
    'A coordinated four-piece festive cup set for drinks during everyday meals or celebrations.',
  '6PCS Shot Glass':
    'A coordinated six-piece shot glass set for serving small drinks at home or during gatherings.',
  '6-Piece Clear Embrossed Glass Tumblers':
    'A six-piece set of clear embossed glass tumblers for serving everyday drinks.',
  'Rose 4PC Faux Glass Tumbler Set':
    'A coordinated four-piece faux-glass tumbler set with a rose-inspired design.',
  'Steel Pot':
    'A steel pot for everyday cooking and a practical addition to a home kitchen.',
  '13PCS Shot Glass':
    'A coordinated thirteen-piece shot glass set for serving small drinks during gatherings.',
  'Fridge Set':
    'A coordinated set for keeping food and small items arranged inside the refrigerator.',
  'Griller with Hotpot':
    'A combination griller and hotpot for preparing shared meals at home.',
  '2 PC 270ml Mug':
    'A two-piece set of 270 ml mugs for everyday hot or cold drinks.',
  'Premium Stainless Steel Bottle':
    'A stainless steel bottle for carrying drinks during work, errands, or travel.',
  '6-PC Flower Bowl Set':
    'A coordinated six-piece flower bowl set for serving snacks, desserts, or meal portions.',
  '2-PC Dessert Tumbler Set with Stirrer':
    'A two-piece dessert tumbler set with stirrers for serving layered drinks or desserts.',
  'Double Hotpot':
    'A double hotpot designed for preparing or serving two selections in one setup.',
  'Flower Bowl Set':
    'A coordinated flower bowl set for serving snacks, desserts, or meal portions.',
  'Dinnerware Set':
    'A coordinated dinnerware set for everyday meals or additional place settings at home.',
  '4PC Fruit Bowl Set w/ Cover':
    'A four-piece fruit bowl set with covers for serving and keeping contents protected.',
  'Felicity Collection 4-PC Plate Set':
    'A coordinated four-piece plate set from the Felicity Collection for everyday meals or gatherings.',
  'Clothes Rack':
    'A freestanding clothes rack for keeping garments arranged and easier to reach.',
  'Rectangular Borosilicate Glass Bakeware with Handle':
    'Rectangular borosilicate glass bakeware with handles for easier carrying and serving.',
  'Meat Griller':
    'An American Power meat griller for preparing grilled food at home.',
}

export function getProductDescription(product) {
  const savedDescription = product.description?.trim()

  if (savedDescription) {
    return savedDescription
  }

  return (
    productDescriptionFallbacks[product.name] ||
    'A new, unused item from the Lovelyn It! collection. See the actual photos for its design, condition, and packaging.'
  )
}
