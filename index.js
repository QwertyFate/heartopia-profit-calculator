// Load recipes from localStorage or initialize empty array
let recipes = JSON.parse(localStorage.getItem('recipes') || '[]');

// API endpoint for server (if available)
const API_BASE = 'http://localhost:3000';

// Load ingredient data and create cost lookup map
let ingredientCostMap = {};
let ingredientDataMap = {}; // Map for full ingredient data by name
let ingredientData = []; // Store full data array

async function loadIngredientData() {
    try {
        const response = await fetch('data.json');
        if (response.ok) {
            ingredientData = await response.json();
            // Create a map for quick lookup: name -> cost
            ingredientCostMap = {};
            // Create a map for full ingredient data: name -> full item data
            ingredientDataMap = {};
            ingredientData.forEach(item => {
                ingredientCostMap[item.Name] = item.Cost || 0;
                ingredientDataMap[item.Name] = item;
            });
        }
    } catch (error) {
        console.error('Failed to load ingredient data:', error);
    }
}

// Calculate total cost of ingredients for a recipe
function calculateIngredientCost(ingredients) {
    let totalCost = 0;
    ingredients.forEach(ingredient => {
        const ingredientName = ingredient.name;
        const quantity = ingredient.quantity || 0;
        const costPerUnit = ingredientCostMap[ingredientName] || 0;
        totalCost += costPerUnit * quantity;
    });
    return totalCost;
}

// Calculate profit for each star rating
function calculateProfit(recipe) {
    const totalIngredientCost = calculateIngredientCost(recipe.ingredients);
    const profit = {};
    
    Object.entries(recipe.sellingPrice).forEach(([star, sellingPrice]) => {
        profit[star] = sellingPrice - totalIngredientCost;
    });
    
    return {
        totalCost: totalIngredientCost,
        profit: profit
    };
}

// Calculate profit from selling raw ingredients at each star level
function calculateRawIngredientProfit(ingredients) {
    const rawProfit = {
        '1-Star': 0,
        '2-Star': 0,
        '3-Star': 0,
        '4-Star': 0,
        '5-Star': 0
    };
    
    const totalCost = calculateIngredientCost(ingredients);
    
    // Calculate total selling price for raw ingredients at each star level
    ingredients.forEach(ingredient => {
        const ingredientName = ingredient.name;
        const quantity = ingredient.quantity || 0;
        const ingredientData = ingredientDataMap[ingredientName];
        
        if (ingredientData) {
            // For each star level, calculate: (raw selling price * quantity) - cost
            Object.keys(rawProfit).forEach(star => {
                const rawSellingPrice = ingredientData[star] || 0;
                rawProfit[star] += (rawSellingPrice * quantity);
            });
        }
    });
    
    // Calculate profit (selling price - cost) for each star level
    Object.keys(rawProfit).forEach(star => {
        rawProfit[star] = rawProfit[star] - totalCost;
    });
    
    return rawProfit;
}

// Calculate profit from selling raw ingredients at a specific star level
function calculateRawIngredientProfitAtStar(ingredients, star) {
    const totalCost = calculateIngredientCost(ingredients);
    let totalSellingPrice = 0;
    
    ingredients.forEach(ingredient => {
        const ingredientName = ingredient.name;
        const quantity = ingredient.quantity || 0;
        const ingredientData = ingredientDataMap[ingredientName];
        
        if (ingredientData) {
            const rawSellingPrice = ingredientData[star] || 0;
            totalSellingPrice += (rawSellingPrice * quantity);
        }
    });
    
    return totalSellingPrice - totalCost;
}

// Get detailed computation breakdown for raw ingredient profit
function getRawIngredientBreakdown(ingredients, star) {
    const breakdown = [];
    let totalSellingPrice = 0;
    
    ingredients.forEach(ingredient => {
        const ingredientName = ingredient.name;
        const quantity = ingredient.quantity || 0;
        const ingredientData = ingredientDataMap[ingredientName];
        
        if (ingredientData) {
            const rawSellingPrice = ingredientData[star] || 0;
            const totalForIngredient = rawSellingPrice * quantity;
            totalSellingPrice += totalForIngredient;
            
            breakdown.push({
                name: ingredientName,
                quantity: quantity,
                unitPrice: rawSellingPrice,
                total: totalForIngredient
            });
        } else {
            breakdown.push({
                name: ingredientName,
                quantity: quantity,
                unitPrice: 0,
                total: 0
            });
        }
    });
    
    return {
        breakdown: breakdown,
        totalSellingPrice: totalSellingPrice
    };
}

// DOM elements
const recipeForm = document.getElementById('recipeForm');
const ingredientsContainer = document.getElementById('ingredientsContainer');
const addIngredientBtn = document.getElementById('addIngredient');
const recipesList = document.getElementById('recipesList');
const resetFormBtn = document.getElementById('resetForm');

// Add ingredient row
addIngredientBtn.addEventListener('click', () => {
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    ingredientItem.innerHTML = `
        <div>
            <label style="font-size: 12px;">Ingredient Name</label>
            <input type="text" class="ingredient-name" placeholder="e.g., Fish" required>
        </div>
        <div>
            <label style="font-size: 12px;">Quantity</label>
            <div style="display: flex; gap: 5px;">
                <input type="number" class="ingredient-quantity" placeholder="1" min="1" required style="flex: 1;">
                <button type="button" class="btn btn-danger remove-ingredient" style="padding: 12px;">×</button>
            </div>
        </div>
    `;
    
    ingredientsContainer.appendChild(ingredientItem);
    
    // Add remove functionality
    ingredientItem.querySelector('.remove-ingredient').addEventListener('click', () => {
        if (ingredientsContainer.children.length > 1) {
            ingredientItem.remove();
        } else {
            alert('At least one ingredient is required');
        }
    });
});

// Remove ingredient functionality for initial row
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-ingredient')) {
        if (ingredientsContainer.children.length > 1) {
            e.target.closest('.ingredient-item').remove();
        } else {
            alert('At least one ingredient is required');
        }
    }
});

// Store pending ingredients to process
let pendingIngredients = [];
let pendingRecipeData = null;

// Check if ingredients exist in data.json
function checkIngredientsExist(ingredients) {
    const missingIngredients = [];
    ingredients.forEach(ingredient => {
        const name = ingredient.name;
        if (!ingredientCostMap.hasOwnProperty(name)) {
            missingIngredients.push(name);
        }
    });
    return missingIngredients;
}

// Show modal for adding new ingredient
function showIngredientModal(ingredientName) {
    const modal = document.getElementById('ingredientModal');
    document.getElementById('modalName').value = ingredientName;
    document.getElementById('modalIngredientName').textContent = `"${ingredientName}" is not in the database. Please add it:`;
    document.getElementById('modalCategory').value = '';
    document.getElementById('modalCost').value = '';
    
    // Reset star prices
    document.getElementById('modalStar1').value = '';
    document.getElementById('modalStar2').value = '';
    document.getElementById('modalStar3').value = '';
    document.getElementById('modalStar4').value = '';
    document.getElementById('modalStar5').value = '';
    
    // Hide star prices group initially
    document.getElementById('starPricesGroup').style.display = 'none';
    
    modal.classList.add('show');
}

// Setup category change handler (will be called after DOM loads)
function setupCategoryChangeHandler() {
    const categorySelect = document.getElementById('modalCategory');
    const starPricesGroup = document.getElementById('starPricesGroup');
    
    if (categorySelect && starPricesGroup) {
        categorySelect.addEventListener('change', (e) => {
            const category = e.target.value;
            if (category === 'Crop' || category === 'Fish') {
                starPricesGroup.style.display = 'block';
            } else {
                starPricesGroup.style.display = 'none';
            }
        });
    }
}

// Close modal
function closeIngredientModal(cancelAll = false) {
    const modal = document.getElementById('ingredientModal');
    modal.classList.remove('show');
    
    // If canceling, clear all pending data
    if (cancelAll && (pendingIngredients.length > 0 || pendingRecipeData)) {
        if (confirm('Cancel adding ingredients? The recipe will not be saved.')) {
            pendingIngredients = [];
            pendingRecipeData = null;
        }
    }
}

// Save new ingredient to data.json
async function saveNewIngredient() {
    const name = document.getElementById('modalName').value.trim();
    const category = document.getElementById('modalCategory').value;
    const cost = parseFloat(document.getElementById('modalCost').value);
    
    if (!name || !category || isNaN(cost)) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Get star prices if category is Crop or Fish
    let star1 = 0, star2 = 0, star3 = 0, star4 = 0, star5 = 0;
    
    if (category === 'Crop' || category === 'Fish') {
        star1 = parseFloat(document.getElementById('modalStar1').value) || 0;
        star2 = parseFloat(document.getElementById('modalStar2').value) || 0;
        star3 = parseFloat(document.getElementById('modalStar3').value) || 0;
        star4 = parseFloat(document.getElementById('modalStar4').value) || 0;
        star5 = parseFloat(document.getElementById('modalStar5').value) || 0;
    }
    
    // Create new ingredient entry
    const newIngredient = {
        Name: name,
        Category: category,
        '1-Star': star1,
        '2-Star': star2,
        '3-Star': star3,
        '4-Star': star4,
        '5-Star': star5,
        Cost: cost
    };
    
    // Add to local data
    ingredientData.push(newIngredient);
    ingredientCostMap[name] = cost;
    ingredientDataMap[name] = newIngredient;
    
    // Save to server (data.json)
    try {
        const response = await fetch(`${API_BASE}/data.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ingredientData)
        });
        
        if (response.ok) {
            console.log('Ingredient saved to data.json');
        }
    } catch (error) {
        console.error('Failed to save ingredient:', error);
        // Still continue even if server save fails
    }
    
    // Close modal
    closeIngredientModal();
    
    // Continue processing pending recipe if any
    if (pendingIngredients.length > 0) {
        processNextPendingIngredient();
    } else if (pendingRecipeData) {
        // All ingredients processed, save the recipe
        finalizeRecipe(pendingRecipeData);
        pendingRecipeData = null;
    }
}

// Process next pending ingredient
function processNextPendingIngredient() {
    if (pendingIngredients.length === 0) {
        if (pendingRecipeData) {
            finalizeRecipe(pendingRecipeData);
            pendingRecipeData = null;
        }
        return;
    }
    
    const nextIngredient = pendingIngredients.shift();
    showIngredientModal(nextIngredient);
}

// Finalize and save recipe
function finalizeRecipe(recipeData) {
    const { recipeName, ingredients, starRates } = recipeData;
    
    // Create recipe object
    const recipe = {
        name: recipeName,
        ingredients: ingredients,
        sellingPrice: starRates
    };
    
    // Add to recipes array
    recipes.push(recipe);
    
    // Save to localStorage
    localStorage.setItem('recipes', JSON.stringify(recipes));
    
    // Try to save to server (recipe.json) if available
    saveRecipesToServer();
    
    // Update UI
    renderRecipes();
    
    // Reset form
    resetForm();
    
    alert('Recipe added successfully!');
}

// Handle form submission
recipeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect recipe data
    const recipeName = document.getElementById('recipeName').value.trim();
    
    // Collect ingredients
    const ingredients = [];
    const ingredientItems = ingredientsContainer.querySelectorAll('.ingredient-item');
    
    ingredientItems.forEach(item => {
        const name = item.querySelector('.ingredient-name').value.trim();
        const quantity = parseInt(item.querySelector('.ingredient-quantity').value);
        
        if (name && quantity > 0) {
            ingredients.push({
                name: name,
                quantity: quantity
            });
        }
    });
    
    // Collect star rates
    const starRates = {
        '1-Star': parseFloat(document.getElementById('star1').value) || 0,
        '2-Star': parseFloat(document.getElementById('star2').value) || 0,
        '3-Star': parseFloat(document.getElementById('star3').value) || 0,
        '4-Star': parseFloat(document.getElementById('star4').value) || 0,
        '5-Star': parseFloat(document.getElementById('star5').value) || 0
    };
    
    // Validate
    if (!recipeName) {
        alert('Please enter a recipe name');
        return;
    }
    
    if (ingredients.length === 0) {
        alert('Please add at least one ingredient');
        return;
    }
    
    // Check for missing ingredients
    const missingIngredients = checkIngredientsExist(ingredients);
    
    if (missingIngredients.length > 0) {
        // Store pending data
        pendingRecipeData = { recipeName, ingredients, starRates };
        pendingIngredients = [...missingIngredients];
        // Process first missing ingredient
        processNextPendingIngredient();
    } else {
        // All ingredients exist, save recipe directly
        finalizeRecipe({ recipeName, ingredients, starRates });
    }
});

// Reset form
resetFormBtn.addEventListener('click', resetForm);

function resetForm() {
    recipeForm.reset();
    
    // Reset ingredients to single row
    ingredientsContainer.innerHTML = `
        <div class="ingredient-item">
            <div>
                <label style="font-size: 12px;">Ingredient Name</label>
                <input type="text" class="ingredient-name" placeholder="e.g., Fish" required>
            </div>
            <div>
                <label style="font-size: 12px;">Quantity</label>
                <input type="number" class="ingredient-quantity" placeholder="1" min="1" required>
            </div>
        </div>
    `;
}

// Search filter variable
let searchFilter = '';

// Render recipes list
function renderRecipes() {
    if (recipes.length === 0) {
        recipesList.innerHTML = '<div class="empty-state">No recipes added yet. Add your first recipe above!</div>';
        return;
    }
    
    // Filter recipes based on search
    const filteredRecipes = recipes.filter(recipe => {
        if (!searchFilter) return true;
        return recipe.name.toLowerCase().includes(searchFilter.toLowerCase());
    });
    
    if (filteredRecipes.length === 0) {
        recipesList.innerHTML = '<div class="empty-state">No recipes match your search.</div>';
        return;
    }
    
    recipesList.innerHTML = filteredRecipes.map((recipe, displayIndex) => {
        // Get actual index in recipes array
        const actualIndex = recipes.findIndex(r => r === recipe);
        const costAndProfit = calculateProfit(recipe);
        const rawProfit = calculateRawIngredientProfit(recipe.ingredients);
        
        return `
        <div class="recipe-item">
            <h3>${recipe.name}</h3>
            <div class="recipe-details">
                <div class="ingredients-list">
                    <h4>Ingredients</h4>
                    ${recipe.ingredients.map(ing => {
                        const cost = ingredientCostMap[ing.name] || 0;
                        const totalCost = cost * ing.quantity;
                        return `<div class="ingredient-entry">${ing.name} × ${ing.quantity} ($${cost.toFixed(0)} × ${ing.quantity} = $${totalCost.toFixed(0)})</div>`;
                    }).join('')}
                    <div class="ingredient-entry" style="font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                        Total Cost: $${costAndProfit.totalCost.toFixed(2)}
                    </div>
                </div>
                <div class="star-prices">
                    <h4>Recipe Profit</h4>
                    ${Object.entries(recipe.sellingPrice).map(([star, price]) => {
                        const profit = costAndProfit.profit[star];
                        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
                        // Calculate profit percentage: (profit / selling price) * 100
                        let profitPercentage = 0;
                        if (price > 0) {
                            profitPercentage = (profit / price) * 100;
                        } else if (profit !== 0) {
                            // If selling price is 0 but profit exists (shouldn't happen normally)
                            profitPercentage = profit > 0 ? Infinity : -Infinity;
                        }
                        const profitPercentageText = isFinite(profitPercentage) ? profitPercentage.toFixed(1) + '%' : (profit > 0 ? '∞' : '-∞');
                        
                        return `
                            <div class="star-price">
                                <div><strong>${star}:</strong> $${price.toFixed(2)}</div>
                                <div class="${profitClass}" style="margin-top: 4px;">Profit: $${profit.toFixed(2)}</div>
                                <div class="${profitClass} profit-percentage">(${profitPercentageText})</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="raw-comparison-section">
                <h4>Raw Ingredient Profit Comparison</h4>
                <p style="font-size: 12px; color: #666; margin-bottom: 15px;">
                    Compare recipe profit vs selling raw ingredients at different star levels
                </p>
                <div style="overflow-x: auto;">
                    <table class="comparison-table">
                        <thead>
                            <tr>
                                <th>Recipe Star</th>
                                <th>Recipe Profit</th>
                                <th>Raw @ 1-Star</th>
                                <th>Raw @ 2-Star</th>
                                <th>Raw @ 3-Star</th>
                                <th>Raw @ 4-Star</th>
                                <th>Raw @ 5-Star</th>
                                <th>Best Option</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(recipe.sellingPrice).map(([recipeStar, recipePrice]) => {
                                const recipeProfit = costAndProfit.profit[recipeStar] || 0;
                                const recipeProfitClass = recipeProfit >= 0 ? 'profit-positive' : 'profit-negative';
                                
                                // Calculate all raw profits
                                const rawProfits = ['1-Star', '2-Star', '3-Star', '4-Star', '5-Star'].map(star => {
                                    return calculateRawIngredientProfitAtStar(recipe.ingredients, star);
                                });
                                
                                // Find best option
                                const allOptions = [
                                    { type: 'Recipe', profit: recipeProfit, label: `Recipe ${recipeStar}` },
                                    { type: 'Raw 1-Star', profit: rawProfits[0], label: 'Raw @ 1-Star' },
                                    { type: 'Raw 2-Star', profit: rawProfits[1], label: 'Raw @ 2-Star' },
                                    { type: 'Raw 3-Star', profit: rawProfits[2], label: 'Raw @ 3-Star' },
                                    { type: 'Raw 4-Star', profit: rawProfits[3], label: 'Raw @ 4-Star' },
                                    { type: 'Raw 5-Star', profit: rawProfits[4], label: 'Raw @ 5-Star' }
                                ];
                                
                                const bestOption = allOptions.reduce((best, current) => 
                                    current.profit > best.profit ? current : best
                                );
                                
                                const bestClass = bestOption.type === 'Recipe' ? 'profit-positive' : 'difference-positive';
                                
                                return `
                                    <tr>
                                        <td><strong>${recipeStar}</strong></td>
                                        <td class="${recipeProfitClass}">$${recipeProfit.toFixed(2)}</td>
                                        ${rawProfits.map((rawProfit, idx) => {
                                            const profitClass = rawProfit >= 0 ? 'profit-positive' : 'profit-negative';
                                            const difference = recipeProfit - rawProfit;
                                            const diffClass = difference >= 0 ? 'difference-positive' : 'difference-negative';
                                            return `<td class="${profitClass}">
                                                $${rawProfit.toFixed(2)}
                                                <div class="${diffClass}" style="font-size: 10px; margin-top: 2px;">
                                                    ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}
                                                </div>
                                            </td>`;
                                        }).join('')}
                                        <td class="${bestClass}" style="font-weight: bold;">
                                            ${bestOption.label}<br>
                                            <span style="font-size: 11px;">$${bestOption.profit.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="computation-section">
                <div class="computation-section-header" onclick="toggleComputationDetails(${actualIndex})">
                    <h4>📊 Detailed Computation Breakdown</h4>
                    <button class="computation-toggle" type="button">
                        Show Details
                        <span class="computation-toggle-icon" id="toggleIcon${actualIndex}">▼</span>
                    </button>
                </div>
                <div class="computation-content" id="computationContent${actualIndex}">
                    <div class="computation-grid" style="margin-top: 15px;">
                    ${Object.entries(recipe.sellingPrice).map(([recipeStar, price]) => {
                        const profit = costAndProfit.profit[recipeStar];
                        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
                        
                        // Show comparison against all 5 star levels
                        const allStarComputations = ['1-Star', '2-Star', '3-Star', '4-Star', '5-Star'].map(star => {
                            const rawProfitValue = calculateRawIngredientProfitAtStar(recipe.ingredients, star);
                            const breakdownData = getRawIngredientBreakdown(recipe.ingredients, star);
                            const difference = profit - rawProfitValue;
                            const differenceClass = difference >= 0 ? 'difference-positive' : 'difference-negative';
                            const differenceText = difference >= 0 ? `+$${difference.toFixed(2)} better` : `$${Math.abs(difference).toFixed(2)} worse`;
                            
                            return `
                                <div class="computation-card" style="margin-bottom: 15px;">
                                    <h5>Recipe ${recipeStar} vs Raw ${star}</h5>
                                    <div class="computation-breakdown">
                                        <div style="margin-bottom: 12px; font-weight: bold; color: #667eea;">Recipe Profit:</div>
                                        <div class="computation-line">Selling Price: <span class="computation-formula">$${price.toFixed(2)}</span></div>
                                        <div class="computation-line">Total Cost: <span class="computation-formula">-$${costAndProfit.totalCost.toFixed(2)}</span></div>
                                        <div class="computation-total ${profitClass}">
                                            Recipe Profit: <span class="computation-formula">$${price.toFixed(2)} - $${costAndProfit.totalCost.toFixed(2)} = $${profit.toFixed(2)}</span>
                                        </div>
                                        
                                        <div style="margin-top: 12px; margin-bottom: 12px; font-weight: bold; color: #667eea;">Raw Ingredient Profit (selling raw @ ${star}):</div>
                                        ${breakdownData.breakdown.map(item => {
                                            if (item.unitPrice > 0) {
                                                return `<div class="computation-line">${item.name} × ${item.quantity} @ $${item.unitPrice.toFixed(2)}<span class="computation-formula">= $${item.total.toFixed(2)}</span></div>`;
                                            } else {
                                                return `<div class="computation-line" style="color: #999;">${item.name} × ${item.quantity} @ $0.00<span class="computation-formula">= $0.00</span></div>`;
                                            }
                                        }).join('')}
                                        <div class="computation-total">
                                            Total Selling Price: <span class="computation-formula">$${breakdownData.totalSellingPrice.toFixed(2)}</span>
                                        </div>
                                        <div class="computation-total">
                                            Total Cost: <span class="computation-formula">-$${costAndProfit.totalCost.toFixed(2)}</span>
                                        </div>
                                        <div class="computation-total ${rawProfitValue >= 0 ? 'profit-positive' : 'profit-negative'}">
                                            Raw Profit: <span class="computation-formula">$${breakdownData.totalSellingPrice.toFixed(2)} - $${costAndProfit.totalCost.toFixed(2)} = $${rawProfitValue.toFixed(2)}</span>
                                        </div>
                                        
                                        <div class="computation-total ${differenceClass}" style="margin-top: 12px; padding-top: 12px; border-top: 2px solid #ddd;">
                                            Difference: Recipe is ${differenceText}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                        
                        return allStarComputations;
                    }).join('')}
                    </div>
                </div>
            </div>
            <div class="button-group">
                <button class="btn btn-danger" onclick="deleteRecipe(${actualIndex})">Delete</button>
            </div>
        </div>
    `;
    }).join('');
}

// Save recipes to server (recipe.json)
async function saveRecipesToServer() {
    try {
        const response = await fetch(`${API_BASE}/recipes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(recipes)
        });
        if (response.ok) {
            console.log('Recipes saved to recipe.json');
        }
    } catch (error) {
        // Server not available, continue with localStorage only
        console.log('Server not available, using localStorage only');
    }
}

// Load recipes from server (recipe.json)
async function loadRecipesFromServer() {
    try {
        const response = await fetch(`${API_BASE}/recipes`);
        if (response.ok) {
            const serverRecipes = await response.json();
            if (Array.isArray(serverRecipes) && serverRecipes.length > 0) {
                recipes = serverRecipes;
                localStorage.setItem('recipes', JSON.stringify(recipes));
                return true;
            }
        }
    } catch (error) {
        // Server not available, continue with localStorage
        console.log('Server not available, using localStorage only');
    }
    return false;
}

// Delete recipe
window.deleteRecipe = function(index) {
    if (confirm('Are you sure you want to delete this recipe?')) {
        recipes.splice(index, 1);
        localStorage.setItem('recipes', JSON.stringify(recipes));
        saveRecipesToServer();
        renderRecipes();
    }
};

// Export recipes to JSON file
window.exportRecipes = function() {
    const dataStr = JSON.stringify(recipes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recipe.json';
    link.click();
    URL.revokeObjectURL(url);
};

// Toggle computation details
window.toggleComputationDetails = function(index) {
    const content = document.getElementById(`computationContent${index}`);
    const header = content.previousElementSibling;
    const button = header.querySelector('.computation-toggle');
    const icon = button.querySelector('.computation-toggle-icon');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        icon.classList.remove('expanded');
        button.innerHTML = 'Show Details <span class="computation-toggle-icon">▼</span>';
    } else {
        content.classList.add('expanded');
        icon.classList.add('expanded');
        button.innerHTML = 'Hide Details <span class="computation-toggle-icon expanded">▼</span>';
    }
};

// Make functions available globally
window.closeIngredientModal = closeIngredientModal;
window.saveNewIngredient = saveNewIngredient;

// Load and display recipes on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load ingredient data first
    await loadIngredientData();
    
    // Try to load from server first
    const loadedFromServer = await loadRecipesFromServer();
    if (loadedFromServer) {
        renderRecipes();
    } else {
        renderRecipes();
    }
    
    // Setup search functionality
    const searchInput = document.getElementById('searchRecipes');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchFilter = e.target.value.trim();
            renderRecipes();
        });
    }
    
    // Setup category change handler for ingredient modal
    setupCategoryChangeHandler();
    
    // Always show export button in recipe list header
    const recipeListHeader = document.querySelector('.recipe-list h2');
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-secondary';
    exportBtn.textContent = 'Export to recipe.json';
    exportBtn.style.marginLeft = '15px';
    exportBtn.style.marginBottom = '20px';
    exportBtn.onclick = window.exportRecipes;
    recipeListHeader.appendChild(exportBtn);
});

